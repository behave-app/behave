import type * as LibAVTypes from "../../public/app/bundled/libavjs/dist/libav.types";
import {assert, promiseWithResolve, getPromiseFromEvent, promiseWithTimeout, asyncSleep} from "./util"
import * as LibAVWebcodecsBridge from "libavjs-webcodecs-bridge";
import { SingleFrameInfo } from "./detections.js"
declare global {
  interface Window {
    LibAV: LibAVTypes.LibAVWrapper;
  }
}

const UUID_ISO_IEC_11578_PLUS_MDPM = new Uint8Array([
  0x17, 0xee, 0x8c, 0x60, 0xf8, 0x4d, 0x11, 0xd9, 0x8c, 0xd6, 0x08, 0x00, 0x20,
  0x0c, 0x9a, 0x66, 0x4d, 0x44, 0x50, 0x4d
])

function dumpPacket(packet: LibAVTypes.Packet) {
  //assumes (for now) a avc (non annex B) packet and dumps it
  const view = new DataView(packet.data.buffer)
  let index = 0
  while (index < view.byteLength) {
    const length = view.getUint32(index)
    if (length < 2) {
      console.log("special case, I run away")
      return
    }
    index += 4
    const startBytes = new Uint8Array(
      packet.data.buffer.slice(index, index + Math.min(length, 16)))
    const str = [...startBytes].map(b => b.toString(16).padStart(2, "0")).join(" ")
    console.log(`length ${length}: ${str}`)
    index += length
  }
}

export function extractNALs(packet: LibAVTypes.Packet): number[] {
  const view = new DataView(packet.data.buffer)
  const nals = []
  let index = 0
  while (index < view.byteLength) {
    const length = view.getUint32(index)
    if (length < 2) {
      console.log("special case, I run away")
      return nals
    }
    index += 4
    nals.push(view.getUint8(index))
    index += length
  }
  return nals
}


function removeEscapeSequences(inputNAL: Uint8Array): Uint8Array {
  const outputNAL = new Uint8Array(inputNAL.length); // Initialize with the same size

  let outputIndex = 0;

  for (let i = 0; i < inputNAL.length; i++) {
    // Check for 0x03 byte
    if (inputNAL[i] === 0x03) {
      // Check the following byte
      if (i + 1 < inputNAL.length && inputNAL[i + 1] <= 0x03 &&
        i >= 2 && inputNAL[i - 1] === 0 && inputNAL[i - 2] === 0
      ) {
        // Skip the escape sequence (0x03)
      } else {
        // If not a valid escape sequence, copy the byte as-is
        outputNAL[outputIndex] = inputNAL[i];
        outputIndex++;
      }
    } else {
      // Copy non-escape sequence bytes as-is
      outputNAL[outputIndex] = inputNAL[i];
      outputIndex++;
    }
  }

  // Create a new Uint8Array with the actual size
  return new Uint8Array(outputNAL.slice(0, outputIndex));
}


export function extractFrameInfo(
  packet: LibAVTypes.Packet,
  isAnnexB: boolean,
): Omit<SingleFrameInfo, "detections" | "pts" | "dts"> {
  if (!isAnnexB) {
    throw new Error("is todo")
  }
  const frameInfo: Partial<ReturnType<typeof extractFrameInfo>>= {}

  let nrOfZeroes = 0
  let nalStartedAt = NaN
  const nals: Array<Uint8Array> = []

  for (let i = 0; i < packet.data.byteLength ; i++) {
    const byte = packet.data.at(i)!
    if (byte === 0) {
      nrOfZeroes++;
      continue
    }
    if (byte === 1) {
      if (nrOfZeroes >= 2) {
        if (Number.isFinite(nalStartedAt)) {
          nals.push(new Uint8Array(
            packet.data.buffer,
            packet.data.byteOffset + nalStartedAt,
            i - nrOfZeroes - nalStartedAt))
        }
        const nalType = packet.data.at(i + 1)! & 0x1f
        if (nalType === 0x01 || nalType === 0x05) {
          // last NAL, no need to continue
          nals.push(new Uint8Array(
            packet.data.buffer,
            packet.data.byteOffset + i + 1,
            packet.data.byteLength - (i + 1)))
          nalStartedAt = NaN
          break
        }
        nalStartedAt = i + 1
      }
    }
    nrOfZeroes = 0
  }
  if (Number.isFinite(nalStartedAt)) {
    nals.push(new Uint8Array(
      packet.data.buffer,
      packet.data.byteOffset + nalStartedAt,
      packet.data.byteLength - nalStartedAt))
  }

  for (const nal of nals) {
    const firstbyte = nal.at(0)!
    const ref = (firstbyte & 0xe0) >> 5
    const nalType = firstbyte & 0x1f
    switch (nalType) {
      case 0x01: {
        switch (ref) {
          case 0:
            frameInfo.type = "B"
            break
          case 2:
            frameInfo.type = "P"
            break
          case 3:
            frameInfo.type = "I"
            break
          default:
            throw new Error(`Uknown ${ref} ${nalType}`)
        }
      } break
      case 0x05: {
        frameInfo.type = "IDR"
      } break
      case 0x06: {
        const unescapedNal = removeEscapeSequences(nal)
        let rest = new Uint8Array(unescapedNal.buffer, unescapedNal.byteOffset + 1)
        while (rest.byteLength) {
          const current = rest
          const type = current.at(0)!
          if (type == 0x80) {
            // padding
            rest = new Uint8Array(current.buffer, current.byteOffset + 1)
            continue
          }
          const length = current.at(1)!
          const newOffset = current.byteOffset + length + 2
          if (newOffset > current.buffer.byteLength) {
            console.log("problem with buffer: ", current.buffer)
            throw new Error("problem with nal 6")
          }
          rest = new Uint8Array(current.buffer, current.byteOffset + length + 2)
          if (type !== 5) {
            continue
          }
          if (length < UUID_ISO_IEC_11578_PLUS_MDPM.byteLength) {
            continue
          }
          for (let i=0; i < UUID_ISO_IEC_11578_PLUS_MDPM.byteLength; i++) {
            if (UUID_ISO_IEC_11578_PLUS_MDPM.at(i)! !== current.at(i + 2)!) {
              console.warn("different nal")
              continue
            }
          }
          const nrItems = current.at(
            2 + UUID_ISO_IEC_11578_PLUS_MDPM.byteLength)!
          if (length !== UUID_ISO_IEC_11578_PLUS_MDPM.byteLength + 1 + nrItems * 5) {
            console.warn("Not sure...")
            continue
          }
          const dataByType: Record<number, number[]> = {}
          const view = new DataView(
            current.buffer, current.byteOffset + 2 + UUID_ISO_IEC_11578_PLUS_MDPM.byteLength + 1)
          for (let itemNr = 0; itemNr < nrItems; itemNr++) {
            const type = view.getUint8(5 * itemNr)
            dataByType[type] = [1, 2, 3, 4].map(i => view.getUint8(5 * itemNr + i))
          }
          if (0x18 in dataByType && 0x19 in dataByType) {
            // strange encoding, where 0x20 --> 20 (decimal)
            const decodeNr = (nr: number) => parseInt(nr.toString(16))
            const [_, century, year2digit, month] = dataByType[0x18].map(decodeNr)
            const offsetRaw = dataByType[0x18][0]
            const [day, hour, min, sec] = dataByType[0x19].map(decodeNr)
            const year = 100 * century + year2digit
            const localHoursOffset = (offsetRaw & 0x40 ? -1 : 1) * (offsetRaw & 0x3f) / 2
            const p2 = (n: number) => n.toString().padStart(2, "0")
            const p4 = (n: number) => n.toString().padStart(4, "0")
            const isoDateString = [p4(year), p2(month), p2(day)].join("-")
            const isoTimeString = [p2(hour), p2(min), p2(sec)].join(":")
            const isoTz = localHoursOffset === 0 ? "Z" :
              `${localHoursOffset > 0 ? "+" : "-"}${p2(Math.floor(Math.abs(localHoursOffset)))}:${p2((Math.abs(localHoursOffset) % 1)*60)}`
            frameInfo.timestamp = `isodate:${isoDateString}T${isoTimeString}${isoTz}` as typeof frameInfo["timestamp"]
          }
        }
      } break
    }
  }
  return frameInfo as ReturnType<typeof extractFrameInfo>
}

(window as unknown as {dumpPacket: (p: LibAVTypes.Packet) => void}).dumpPacket = dumpPacket

type VideoInfo = {
  readonly startTick: number,
  readonly endTick: number,
  readonly durationTicks: number,
  // this is a best guess, assuming the frame rate is constant. This is in TS
  readonly frameDurationTicks: number,
  // observed gop length in first X frames
  // Note: We mean nr of frames between 2 frames that ffmpeg sees as key frames
  readonly maxGopLength: number,
  // The values below are calculated from those above (and stream info)
  readonly startSecond: number,
  readonly endSecond: number,
  readonly durationSeconds: number,
  readonly frameDurationSeconds: number,
  readonly numberOfFramesInStream: number,
  readonly fps: number,
}

export function splitLowHigh(combined: number): {lo: number, hi: number} {
  const hi = Math.floor(combined / 0x100000000)
  const lo = combined & 0xFFFFFFFF
  return {hi, lo}
}

export function combineLowHigh(lo: number, hi: number): number {
  const unsigned_lo = lo >= 0 ? lo : lo + 0x100000000
  const tsCombined = unsigned_lo + hi * 0x100000000
  if (!Number.isSafeInteger(tsCombined)) {
    throw new Error("Unsafe")
  }
  return tsCombined
}

type FrameCacheItem = null | "loading" | "pastEOS" | VideoFrame

class FrameCache {
  private cache: FrameCacheItem[]
  private _waiter: ReturnType<typeof promiseWithResolve<void>>
  constructor(
    private _currentFrameNumber: number,
    public readonly  preCurrentSize: number,
    public readonly postCurrentSize: number,
  ) {
    this.cache = new Array(preCurrentSize + 1 + postCurrentSize).fill(null)
    this._waiter = promiseWithResolve()
  }

  isPartOfCacheSection(frameNumber: number): boolean {
    if (frameNumber < 0 || !Number.isInteger(frameNumber)) {
      throw new Error("Only non-negative ints are allowed, got " + frameNumber)
    }
    const diff = frameNumber - this._currentFrameNumber
    if (diff > 0) {
      return diff <= this.postCurrentSize
    } else {
      return -diff <= this.preCurrentSize
    }
  }

  get(frameNumber: number): FrameCacheItem {
    if (!this.isPartOfCacheSection(frameNumber)) {
      throw new Error(
        `Request for ${frameNumber} when current = ${this._currentFrameNumber}`)
    }
    return this.cache[frameNumber % this.cache.length]
  }

  setIfPartOfCacheSection(frameNumber: number, item: FrameCacheItem) {
    if (this.isPartOfCacheSection(frameNumber)) {
      this.set(frameNumber, item)
    }
  }

  set(frameNumber: number, item: FrameCacheItem) {
    if (!this.isPartOfCacheSection(frameNumber)) {
      throw new Error(
        `Request for ${frameNumber} when current = ${this._currentFrameNumber}`)
    }
    const index = frameNumber % this.cache.length
    const oldItem = this.cache[index]
    if (oldItem instanceof VideoFrame) {
      oldItem.close()
    }
    this.cache[index] = item
    this.fireChange()
  }

  get currentFrameNumber() {
    return this._currentFrameNumber
  }

  findIndex(
    predicate: (item: FrameCacheItem, frameNumber: number) => boolean,
    startIndex?: number,
    endIndexInclusive?: number,
  ) {
    startIndex = Math.max(0, startIndex ?? this.currentFrameNumber - this.preCurrentSize)
    endIndexInclusive = endIndexInclusive ?? this.currentFrameNumber + this.postCurrentSize
    if (!this.isPartOfCacheSection(startIndex)
      || !this.isPartOfCacheSection(endIndexInclusive)) {
      throw new Error(`[${startIndex}, ${endIndexInclusive}] not in range`)
    }
    for (let nr = startIndex; nr <= endIndexInclusive; nr++) {
      if (predicate(this.cache[nr % this.cache.length], nr)) {
        return nr
      }
    }
    return -1
  }

  setCurrentFrameNumber(newFrameNumber: number) {
    if (newFrameNumber === this._currentFrameNumber) {
      return
    }
    let startIndexToWipe: number
    let endIndexToWipe: number
    if (Math.abs(newFrameNumber - this._currentFrameNumber) > this.cache.length) {
      startIndexToWipe = 0;
      endIndexToWipe = this.cache.length - 1
    } else if (newFrameNumber > this._currentFrameNumber) {
      startIndexToWipe = this._currentFrameNumber - this.preCurrentSize
      endIndexToWipe = newFrameNumber - this.preCurrentSize - 1
    } else {
      startIndexToWipe = newFrameNumber + this.postCurrentSize + 1
      endIndexToWipe = this._currentFrameNumber + this.postCurrentSize
    }
    for (let i = startIndexToWipe; i <= endIndexToWipe; i++) {
      const index = i % this.cache.length
      const item = this.cache[index]
      if (item instanceof VideoFrame) {
        item.close()
      }
      this.cache[index] = null
    }
    this._currentFrameNumber = newFrameNumber
    this.fireChange()
  }

  get waitForChange() {
    return this._waiter.promise
  }

  fireChange() {
    this._waiter.resolve()
    this._waiter = promiseWithResolve()
  }

  get state() {
    return {
      "null": this.cache.filter(x => x === null).length,
      "loading": this.cache.filter(x => x === "loading").length,
      "frame": this.cache.filter(x => x instanceof VideoFrame).length,
    }
  }
}

type PacketStreamState = {
  state: "streaming", packetCache: LibAVTypes.Packet[], endOfStream: boolean, locked: boolean
} | {
  state: "stopped",
} | {
  state: "seeking",
}

type FrameStreamState = {
  state: "streaming", frameCache: FrameCache,
} | {
  state: "closed"
}

export class Video {
  static AV_PKT_FLAG_KEY = 1 as const // since it's not exposed in libavjs
  static AV_PKT_FLAG_DISCARD = 4 as const // since it's not exposed in libavjs
  static DEFAULT_LIBAV_OPTIONS: LibAVTypes.LibAVOpts = {
    noworker: false,
    nothreads: true,
  } as const;
  static FRAME_CACHE_MAX_SIZE = 5 as const;
  static VIDEO_DEQUEUE_QUEUE_MAX_SIZE = 24 as const;
  static FAKE_FIRST_FRAME_TIMESTAMP = Number.MIN_SAFE_INTEGER;
  public readonly libav: LibAVTypes.LibAV = null as unknown as LibAVTypes.LibAV;
  public readonly formatContext = null as unknown as number
  public readonly videoStream = null as unknown as LibAVTypes.Stream
  public readonly videoInfo = null as unknown as VideoInfo
  public readonly ticksToUsFactor: number = null as unknown as number;
  private packetStreamState: PacketStreamState = {state: "stopped"}
  private frameStreamState: FrameStreamState = null as unknown as FrameStreamState
  private frameInfo: null | Map<number, Omit<SingleFrameInfo, "detections">>

  constructor(public readonly input: File) {
    this.frameInfo = null
  }

  async init(options?: {
    libavoptions?: LibAVTypes.LibAVOpts,
    keepFrameInfo?: boolean
  }) {
    if (options?.keepFrameInfo ?? false) {
      this.frameInfo = new Map()
    }
    const _rwthis = this as {
      -readonly [K in keyof typeof this]: typeof this[K]
    }
    if (_rwthis.libav !== null) {
      throw new Error("already inited");
    }
    const libavoptions =
      (options ?? {}).libavoptions ?? Video.DEFAULT_LIBAV_OPTIONS;

    // need to cast until PR #43 is merged into libavjs
    _rwthis.libav = await window.LibAV.LibAV(
      libavoptions as LibAVTypes.LibAVOpts & { noworker: false }
    );
    await this.libav.av_log_set_level(this.libav.AV_LOG_ERROR);
    await this.libav.mkreadaheadfile(this.input.name, this.input);
    const [fmt_ctx, streams] = await this.libav.ff_init_demuxer_file(
      this.input.name
    );
    const video_streams: LibAVTypes.Stream[] = streams.filter(
      (s) => s.codec_type === this.libav.AVMEDIA_TYPE_VIDEO
    );
    if (video_streams.length !== 1) {
      throw new Error(
        `Problem with file ${this.input.name}, contains ${video_streams.length} video streams: ${video_streams}`
      );
    }
    _rwthis.formatContext = fmt_ctx;
    _rwthis.videoStream = video_streams[0];
    _rwthis.ticksToUsFactor = 
      1e6 * this.videoStream.time_base_num / this.videoStream.time_base_den
    await this.setVideoInfo()
    const frameCache = new FrameCache(0, 50, 50)
    this.frameStreamState = {state: "streaming", frameCache}
    void(this.frameCacheFiller())
  }

  public getInfoForFrame(frameNumber: number) {
    if (!this.frameInfo) {
      throw new Error("FrameInfo is switched off")
    }
    return this.frameInfo.get(frameNumber) ?? null
  }

  public async getInitialisedVideoDecoder(
    callback: (frame: VideoFrame) => void
  ): Promise<VideoDecoder> {
    const videoDecoder = new VideoDecoder({
      output: (frame) => {
        if (frame.timestamp === Video.FAKE_FIRST_FRAME_TIMESTAMP) {
          frame.close();
        } else {
          callback(frame)
        }
      },
      error: (error) => console.log("Video decoder error", { error }),
    });
    const decoderConfig = (await LibAVWebcodecsBridge.videoStreamToConfig(
      this.libav,
      this.videoStream
    )) as VideoDecoderConfig;
    // TODO: first try hardware, if fails try software
    decoderConfig.hardwareAcceleration = "prefer-software";
    videoDecoder.configure(decoderConfig);
    videoDecoder.decode(await createFakeKeyFrameChunk(decoderConfig));
    return videoDecoder
  }

  private async setVideoInfo() {
    // NOTE: this will not work if it's not called as the very first thing after
    // the file is loaded
    const NR_GOPS_TO_CHECK = 2

    const keyFrameUs_s = new Set<number>()
    let done = false

    let startTick: number | undefined = undefined
    const frameDurationTicks_s: number[] = []
    let maxGopLength: number | undefined = undefined
    let gopLength: number = 0
    let gopCount = 0
    let lastFrameTimestamp: number | undefined = undefined
    const videoDecoder = await this.getInitialisedVideoDecoder(frame => {
      const isKey = keyFrameUs_s.has(frame.timestamp)
      if (isKey) {
        if (gopCount > 0) {
          maxGopLength = Math.max(maxGopLength ?? 0, gopLength)
        }
        gopLength = 0
        gopCount++
      }
      if (gopCount > NR_GOPS_TO_CHECK) {
        done = true
        frame.close()
        return
      }
      if (startTick === undefined) {
        startTick = frame.timestamp
      }
      if (lastFrameTimestamp !== undefined) {
        const sinceLastFrameTicks = frame.timestamp - lastFrameTimestamp
        frameDurationTicks_s.push(sinceLastFrameTicks)
      }
      frame.close()
      gopLength++
      lastFrameTimestamp = frame.timestamp
    })

    await (async () => {
      while (!done) {
        const {endOfFile, videoPackets} = await this.doReadMulti()
        for (const packet of videoPackets) {
          while (videoDecoder.decodeQueueSize > 10) {
            await getPromiseFromEvent(videoDecoder, "dequeue")
          }
          if (done) {
            break;
          }
          const isKeyFrame = (packet.flags ?? 0) & Video.AV_PKT_FLAG_KEY
          const pts = combineLowHigh(packet.pts!, packet.ptshi!)
          if (isKeyFrame) {
          keyFrameUs_s.add(pts)
          }
          if (keyFrameUs_s.size === 0) {
            continue
          }
          const chunk = new EncodedVideoChunk({
            type: isKeyFrame ? "key" : "delta",
            timestamp: pts,
            duration: 100,
            data: packet.data.buffer,
          })
          videoDecoder.decode(chunk)
        }
        if (endOfFile) {
          throw new Error("Pfff, file with fewer than two GOPs....")
        }
      }
    })()

    // do not flush, we don't want any additional frames
    videoDecoder.close()

    const frameDurationTicks = (new Set(frameDurationTicks_s).size === 1)
      ? frameDurationTicks_s[0] : "variable"

    assert(startTick !== undefined)
    assert(frameDurationTicks !== undefined)
    assert(maxGopLength !== undefined)
    assert(frameDurationTicks !== "variable", "" + frameDurationTicks_s)
    const durationTicks = combineLowHigh(
      await this.libav.AVStream_duration(this.videoStream.ptr),
      await this.libav.AVStream_durationhi(this.videoStream.ptr),
    )
    const endTick = startTick + durationTicks
    // some magic to write to readonly property
    const _rwthis = this as {-readonly [K in keyof typeof this]: typeof this[K]}
    _rwthis.videoInfo = {
      startTick,
      endTick,
      durationTicks,
      frameDurationTicks,
      maxGopLength,
      startSecond: startTick * this.ticksToUsFactor / 1e6,
      endSecond: endTick * this.ticksToUsFactor / 1e6,
      durationSeconds: durationTicks * this.ticksToUsFactor / 1e6,
      frameDurationSeconds: frameDurationTicks * this.ticksToUsFactor / 1e6,
      numberOfFramesInStream: Math.round(durationTicks / frameDurationTicks),
      fps: 1e6 / (frameDurationTicks * this.ticksToUsFactor),
    }
  }

  async deinit() {
    await this.libav.unlink(this.input.name);
    this.libav.terminate();
    this.frameStreamState = {state: "closed"}
  }

  async doReadMulti(
  ): Promise<{endOfFile: boolean, videoPackets: LibAVTypes.Packet[]}> {
    const pkt = await this.libav.av_packet_alloc()
    const [result, packets] = await this.libav.ff_read_multi(
      this.formatContext,
      pkt,
      undefined,
      { limit: .25 * 1024 * 1024 }
    );
    await this.libav.av_packet_free_js(pkt)
    const endOfFile = result === this.libav.AVERROR_EOF
    if (result !== 0 && result !== -this.libav.EAGAIN && !endOfFile) {
      throw new Error("Result is error: " + result)
    }
    return {endOfFile, videoPackets: packets[this.videoStream.index] ?? []}
  }

  /**
   * Returns the next packet in the stream.
   * Note that this function may not be called at the same time as
   * this funcions is running or while seeking is being done
   *
   */
  async packetStreamNext(): Promise<LibAVTypes.Packet | null> {
    if (this.packetStreamState.state !== "streaming") {
      throw new Error("Should not happen")
    }
    if (this.packetStreamState.locked) {
      throw new Error("Should not happen")
    }
    if (this.packetStreamState.packetCache.length) {
      return this.packetStreamState.packetCache.pop()!
    }
    if (this.packetStreamState.endOfStream) {
      return null
    }
    this.packetStreamState.locked = true
    const result = await this.doReadMulti()
    this.packetStreamState.endOfStream = result.endOfFile
    this.packetStreamState.packetCache = [
      ...result.videoPackets.reverse(),
      ...this.packetStreamState.packetCache, // even though this should be empty
    ]
    this.packetStreamState.locked = false
    return await this.packetStreamNext()
  }

  /**
   * Seeks the current stream.
   * The result will be that streaming will start on a keyframe before
   * (or at) the requested frame
   *
   * Returns the pts that will be streamed from on subsequent streams
   *
   * Note that a lot of the code in here is to deal with mpegts.
   * mp4 can seek to keyframe before pts = X; mpegts cannot :(
   */
  async packetStreamSeek(frameNumber: number): Promise<void> {
    if (this.packetStreamState.state === "seeking" || (
        this.packetStreamState.state === "streaming" && this.packetStreamState.locked)) {
      throw new Error("One can only call this function on an unlocked streaming")
    }
    this.packetStreamState = {state: "seeking"}
    try {
      if (frameNumber === 0) {
        const seekFlags = this.libav.AVSEEK_FLAG_BYTE
        await this.libav.avformat_seek_file_max(
          this.formatContext, this.videoStream.index, 0, 0, seekFlags)
        return
      }
      const frameNumberPts = this.videoInfo.startTick
        + frameNumber * this.videoInfo.frameDurationTicks
      const {lo: ptslo, hi: ptshi} = splitLowHigh(frameNumberPts)
      const seekFlags = 0
      await this.libav.avformat_seek_file_max(
        this.formatContext, this.videoStream.index, ptslo, ptshi, seekFlags)
    } finally {
      this.packetStreamState = {
        state: "streaming", packetCache: [], endOfStream: false, locked: false}
    }
  }

  /**
   * This method should be called (and not awaited) once.
   * It will make sure the frameCache is being filled
   *
   * TODO: think of a way to close the VideoDecoder and kill this loop
   * when we're ready to terminate
   */
  async frameCacheFiller(): Promise<void> {
    const decoderConfig = await LibAVWebcodecsBridge.videoStreamToConfig(
      this.libav, this.videoStream) as VideoDecoderConfig;
    const isAnnexB = !(decoderConfig.description ?? null)
    if (this.frameStreamState.state !== "streaming") {
      throw new Error("already closed")
    }
    const PRE_CACHE_ITEMS = 12
    const POST_CACHE_ITEMS = 12
    const MAX_ITEMS_IN_DECODER_QUEUE = 10
    const SMALL_DIFFERENCE = PRE_CACHE_ITEMS + POST_CACHE_ITEMS + 15
    const frameCache = this.frameStreamState.frameCache
    assert(PRE_CACHE_ITEMS <= frameCache.preCurrentSize / 2)
    assert(POST_CACHE_ITEMS <= frameCache.postCurrentSize / 2)

    const startTick = this.videoInfo.startTick
    const frameDurationTicks = this.videoInfo.frameDurationTicks

    const videoDecoder = await this.getInitialisedVideoDecoder(frame => {
      const tick = Math.round(frame.timestamp / this.ticksToUsFactor)
      const frameNumber = (tick - startTick) / frameDurationTicks
      if (frameCache.isPartOfCacheSection(frameNumber)) {
        frameCache.set(frameNumber, frame)
      } else {
        console.debug(`Dropping non cacheable frame`, frameNumber)
        frame.close()
      }
    });


    const findFrameNumberToProcess = (): number | null => {
      const currentFrameNumber = frameCache.currentFrameNumber
      const firstCurrentOrFutureMissing = frameCache.findIndex(
        (item: FrameCacheItem) => item === null,
        currentFrameNumber,
        currentFrameNumber + POST_CACHE_ITEMS,
      )
      if (firstCurrentOrFutureMissing !== -1) {
        return firstCurrentOrFutureMissing
      }
      const firstPastMissing = frameCache.findIndex(
        (item: FrameCacheItem) => item === null,
        Math.max(0, currentFrameNumber - PRE_CACHE_ITEMS),
        Math.max(0, currentFrameNumber - 1),
      )
      if (firstPastMissing !== -1) {
        return firstPastMissing
      }
      return null
    }

    ;(window as unknown as {frameCache: FrameCache}).frameCache = frameCache
    ;(window as unknown as {video: Video}).video = this
    let lastFrameNumberToAddToDecoder = undefined as number | undefined | "good enough"
    while (this.frameStreamState.state === "streaming") {
      if (videoDecoder.decodeQueueSize > MAX_ITEMS_IN_DECODER_QUEUE) {
        await promiseWithTimeout(
          getPromiseFromEvent(videoDecoder, "dequeue"), 500)
        continue
      }
      const nextFrameNumberToLoad = findFrameNumberToProcess()
        await asyncSleep(10)
      if (frameCache.get(frameCache.currentFrameNumber) instanceof VideoFrame) {
        await asyncSleep(1)
      }
      if (nextFrameNumberToLoad === null) {
        await frameCache.waitForChange
        continue
      }
      const diffBetweenToLoadAndLast = lastFrameNumberToAddToDecoder === "good enough" ? 0 : lastFrameNumberToAddToDecoder === undefined ? NaN : nextFrameNumberToLoad - lastFrameNumberToAddToDecoder
      // NaN always compares to false
      if (diffBetweenToLoadAndLast < SMALL_DIFFERENCE // bit in the future
        && diffBetweenToLoadAndLast > -5 //  just a couple if in past because of out of order frames
      ) {
        // always add two packets in case of interlaced stream
        // doesn't hurt in non-interlaced stream
        for (let i=0; i < 2; i++) {
          const packet = await this.packetStreamNext()
          if (packet === null) {
            frameCache.set(nextFrameNumberToLoad, "pastEOS")
            await videoDecoder.flush()
            continue
          }
          const pts = combineLowHigh(packet.pts!, packet.ptshi!)
          const framenr = (pts - startTick) / frameDurationTicks
          if (framenr < 0) {
            // these frames we should ignore
            continue
          }
          if (Number.isInteger(framenr)) {
            frameCache.setIfPartOfCacheSection(framenr, "loading")
          }
          if (this.frameInfo && !this.frameInfo.has(framenr)) {
            const frameInfo = {
              ...extractFrameInfo(packet, isAnnexB),
              pts,
              dts: this.libav.i64tof64(packet.dts!, packet.dtshi!)
            }
            this.frameInfo.set(framenr, frameInfo)
          }
          const chunk = new EncodedVideoChunk({
            type: ((packet.flags ?? 0) & Video.AV_PKT_FLAG_KEY) ? "key" : "delta",
            timestamp: combineLowHigh(packet.pts!, packet.ptshi!) * this.ticksToUsFactor,
            duration: 100,
            data: packet.data.buffer,
          })
          videoDecoder.decode(chunk)
          lastFrameNumberToAddToDecoder = framenr
        }
        continue
      } else {
        console.log("flush before seek")
        await videoDecoder.flush()
        videoDecoder.decode(await createFakeKeyFrameChunk(decoderConfig))
        console.log("seek to framenr " + nextFrameNumberToLoad)
        await this.packetStreamSeek(nextFrameNumberToLoad)
        lastFrameNumberToAddToDecoder = "good enough"
        continue
      }
    }
    videoDecoder.close()
  }

  async *getFrames(): AsyncGenerator<VideoFrame, void, void> {
    let frameNumber = 0
    while (true) {
      const frame = await this.getFrame(frameNumber)
      if (frame === "EOF" || frame === null) {
        return
      }
      yield frame
      frameNumber++

    }
  }

  async getFrame(frameNumber: number): Promise<VideoFrame | null | "EOF"> {
    if (this.frameStreamState.state !== "streaming") {
      throw new Error("already closed")
    }
    this.frameStreamState.frameCache.setCurrentFrameNumber(frameNumber)
    while (true) {
      if (this.frameStreamState.frameCache.currentFrameNumber !== frameNumber) {
      //console.log(this.frameStreamState.frameCache.state.frame)
    console.log("abort getting ", frameNumber)
        return null
      }
      const item = this.frameStreamState.frameCache.get(frameNumber)
      if (item === "pastEOS") {
        return "EOF"
      }
      if (item instanceof VideoFrame) {
        return item
      }
      await this.frameStreamState.frameCache.waitForChange
    }
  }

}

export async function getNumberOfFrames(input: File): Promise<number> {
  const FFPROBEOUTPUT = "__ffprobe_output__";
  const libav = await window.LibAV.LibAV({ noworker: false, nothreads: true });
  try {
    await libav.mkreadaheadfile(input.name, input);
    await libav.mkwriterdev(FFPROBEOUTPUT);
    let writtenData = new Uint8Array(0);
    libav.onwrite = function (_name, pos, data) {
      const newLen = Math.max(writtenData.length, pos + data.length);
      if (newLen > writtenData.length) {
        const newData = new Uint8Array(newLen);
        newData.set(writtenData);
        writtenData = newData;
      }
      writtenData.set(data, pos);
    };
    const exit_code = await libav.ffprobe(
      "-show_streams",
      "-hide_banner",
      "-loglevel",
      "error",
      "-of",
      "json",
      "-o",
      FFPROBEOUTPUT,
      input.name
    );
    if (exit_code != 0) {
      throw new Error(`ffprobe exit code: ${exit_code}`);
    }
    await libav.unlink(input.name);
    await libav.unlink(FFPROBEOUTPUT);
    const outputjson = new TextDecoder("utf-8").decode(writtenData);
    try {
      const videostreams = JSON.parse(outputjson).streams.filter(
        (s: { codec_type: string }) => s.codec_type === "video"
      );
      if (videostreams.length !== 1) {
        throw new Error("Too many videostreams");
      }
      const duration = parseFloat(videostreams[0].duration);
      const avg_frame_rate = videostreams[0].avg_frame_rate.split("/");
      const nrframes = Math.round(
        (duration / parseInt(avg_frame_rate[1] ?? "1")) *
          parseInt(avg_frame_rate[0])
      );
      if (!Number.isInteger(nrframes)) {
        throw new Error(`Unexpected number of frames: ${nrframes}`);
      }
      return nrframes;
    } catch (e) {
      throw new Error(
        `Problem parsing number of packets: ${JSON.stringify(
          outputjson
        )}; ${e}}`
      );
    }
  } finally {
    libav.terminate();
  }
}

/**
 * See https://github.com/Yahweasel/libavjs-webcodecs-bridge/issues/3#issuecomment-1837189047 for more info
 */
export async function createFakeKeyFrameChunk(
  decoderConfig: VideoDecoderConfig
): Promise<EncodedVideoChunk> {
  const { promise, resolve, reject } = promiseWithResolve<EncodedVideoChunk>();
  const encoderConfig = { ...decoderConfig } as VideoEncoderConfig;
  // encoderConfig needs a width and height set; it seems to not matter for
  // annexB, but it does matter for avcc
  encoderConfig.width = 1920;
  encoderConfig.height = 1080;
  encoderConfig.avc = { format: decoderConfig.description ? "avc" : "annexb" };
  const videoEncoder = new VideoEncoder({
    output: (chunk, _metadata) => resolve(chunk),
    error: (e) => reject(e),
  });
  try {
    videoEncoder.configure(encoderConfig);
    const oscanvas = new OffscreenCanvas(
      encoderConfig.width,
      encoderConfig.height
    );
    // getting context seems to be minimal needed before it can be used as VideoFrame source
    oscanvas.getContext("2d");
    const videoFrame = new VideoFrame(oscanvas, {
      timestamp: Video.FAKE_FIRST_FRAME_TIMESTAMP,
    });
    try {
      videoEncoder.encode(videoFrame);
      await videoEncoder.flush();
      const chunk = await promise;
      return chunk;
    } finally {
      videoFrame.close();
    }
  } finally {
    videoEncoder.close();
  }
}
