import { xxh64sum } from '../lib/fileutil'
import {nonEmptyFileExists, type FileTreeLeaf} from "../lib/FileTree"
import { getPartsFromTimestamp, partsToIsoDate, ISODateTimeString, ISODATETIMESTRINGREGEX } from "../lib/datetime"
import { EXTENSIONS } from '../lib/constants'
import { getLibAV, type LibAVTypes } from "../lib/libavjs"

import {ObjectEntries, ObjectFromEntries, assert, promiseWithResolve, getPromiseFromEvent, ObjectKeys, enumerateAsyncGenerator, hexDump} from "../lib/util"
import * as LibAVWebcodecsBridge from "libavjs-webcodecs-bridge";
import { VideoMetadata, videoMetadataChecker, definiteFrameTypeInfoChecker} from '../lib/video-shared'
import { ArrayChecker, Checker, LiteralChecker, RecordChecker, StringChecker, UnknownChecker, getCheckerFromObject } from '../lib/typeCheck'
import { FrameInfo, extractFrameInfo } from "./frameinfo"
import { parseAvcDecoderConfigurationRecord, parseSpsNalUnit, SpsCore  } from './avcc-parser';
import { extractSttsAndCttsBox } from './mp4atoms'

type VideoInfo = {
  // the pts of the first frame
  readonly startTick: number,
  // the pts of the last frame
  readonly endTick: number,
  // basically endtick - starttick
  readonly durationTicks: number,
  // number of ticks that one frame takes
  // this is a best guess, assuming the frame rate is constant. This is in TS
  readonly avgFrameDurationTicks: number,
  // The values below are calculated from those above (and stream info)
  readonly durationSeconds: number,
  readonly numberOfFramesInStream: number,
  readonly avgFps: number,
  readonly startsWithIDRFrame: boolean
  readonly exactPts_s: "N/A" | number[]
}

export class Video {
  static AV_PKT_FLAG_KEY = 1 as const // since it's not exposed in libavjs
  static AV_PKT_FLAG_DISCARD = 4 as const // since it's not exposed in libavjs
  static DEFAULT_LIBAV_OPTIONS: LibAVTypes.LibAVOpts = {
    noworker: false,
    nothreads: false,
  } as const;
  static VIDEO_DEQUEUE_QUEUE_MAX_SIZE = 24 as const;
  static FAKE_FIRST_FRAME_TIMESTAMP = Number.MIN_SAFE_INTEGER;
  public readonly libav: LibAVTypes.LibAV = null as unknown as LibAVTypes.LibAV;
  public readonly formatContext = null as unknown as number
  public readonly videoStream = null as unknown as LibAVTypes.Stream
  public readonly videoInfo = null as unknown as VideoInfo
  public readonly ticksToUsFactor: number = null as unknown as number;
  private playbackStarted: boolean = false

  constructor(public readonly input: File) {
  }

  private async openVideoFile() {
    const _rwthis = this as {
      -readonly [K in keyof typeof this]: typeof this[K]
    }
    if (_rwthis.libav !== null) {
      throw new Error("already inited");
    }
    const LibAV = await getLibAV()
    _rwthis.libav = await LibAV.LibAV(Video.DEFAULT_LIBAV_OPTIONS);
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

  }

  async init(_options: Record<never, never>) {
    await this.openVideoFile()
    // for later TODO see if we can manage without setVideoInfo :)
    await this.setVideoInfo()

    // reinitialize the stream to make sure we seek to 0
    await this.libav.unlink(this.input.name);
    this.libav.terminate();

    const _rwthis = this as {libav: LibAVTypes.LibAV | null}

    _rwthis.libav = null;
    await this.openVideoFile()
    this.playbackStarted = false;
  }


  public async getPtsListForMp4(startPts: number): Promise<number[]> {
    assert(this.input.name.toLowerCase().endsWith(
      EXTENSIONS.videoFileMp4.toLowerCase()))
    const {stts, ctts} = await extractSttsAndCttsBox(
      this.input, {index: this.videoStream.index})
    assert(stts)
    const dts_base0_s: number[] = [0]
    let last_value = 0
    const data = new DataView(stts.entries)
    for (let i = 0; i < data.byteLength; i += 8) {
      const repeat = data.getUint32(i)
      const value = data.getUint32(i + 4)
      for (let j = 0; j < repeat; j++) {
        last_value = last_value + value
        dts_base0_s.push(last_value)
      }
    }
    const pts: number[] = dts_base0_s.map(t => t + startPts)
    if (ctts) {
      const data = new DataView(ctts.entries)
      let index = 0;
      for (let i = 0; i < data.byteLength; i += 8) {
        const repeat = data.getUint32(i)
        const value = ctts.version === 1 ? data.getInt32(i + 4) : data.getUint32(i + 4)
        for (let j = 0; j < repeat; j++) {
          pts[index] += value
          index++
        }
      }
      pts.sort()
    }
    return pts
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
    // for later TODO: first try hardware, if fails try software
    decoderConfig.hardwareAcceleration = "prefer-software";
    videoDecoder.configure(decoderConfig);
    if (!this.videoInfo.startsWithIDRFrame) {
      videoDecoder.decode(await createFakeKeyFrameChunk(
        await this.libav.AVCodecParameters_width(this.videoStream.codecpar),
        await this.libav.AVCodecParameters_height(this.videoStream.codecpar),
        decoderConfig));
    }
    return videoDecoder
  }

  private async setVideoInfo() {
    const MAX_GOPS_TO_CHECK = 2
    let startTick: number | undefined = undefined
    const frameDurationTicks_s: number[] = []
    let gopCount = 0
    let lastFrameTimestamp: number | undefined = undefined
    let startsWithIDRFrame: boolean | undefined = undefined

    for await (const [framenr, frameInfo]
    of enumerateAsyncGenerator(this.getFrameInfoInPtsOrder())) {
      if (framenr === 0) {
        startTick = frameInfo.pts
        startsWithIDRFrame = frameInfo.type === "IDR"
      } else {
        frameDurationTicks_s.push(frameInfo.pts - lastFrameTimestamp!)
      }
      lastFrameTimestamp = frameInfo.pts
      if (frameInfo.type === "IDR" || frameInfo.type === "I") {
        gopCount++;
      }
      if (gopCount > MAX_GOPS_TO_CHECK) {
        break;
      }
    }

    assert(startTick !== undefined)
    assert(startsWithIDRFrame !== undefined)
    if (this.input.name.toLowerCase().endsWith(EXTENSIONS.videoFileMp4.toLowerCase())) {
      // mp4 has this data explicit in stts and ctts box atoms
      const pts_list = await this.getPtsListForMp4(startTick)
      const numberOfFramesInStream = pts_list.length - 1
      assert(numberOfFramesInStream >= 1)
      const endTick = pts_list.at(-2)!
      const durationTicks = endTick - startTick
      const durationSeconds = durationTicks * this.ticksToUsFactor / 1e6
      const avgFrameDurationTicks = (pts_list.at(-1)! - pts_list[0]) / numberOfFramesInStream
      const avgFps = 1e6 / (avgFrameDurationTicks * this.ticksToUsFactor)
      const _rwthis = this as {-readonly [K in keyof typeof this]: typeof this[K]}
      _rwthis.videoInfo = {
        startTick,
        endTick,
        durationTicks,
        avgFrameDurationTicks,
        durationSeconds,
        numberOfFramesInStream,
        avgFps,
        startsWithIDRFrame,
        exactPts_s: pts_list,
      }
    } else {
      // for MTS we rely on the data from libavjs and get approximate values
      const avgFrameDurationTicks = (new Set(frameDurationTicks_s).size === 1)
        ? frameDurationTicks_s[0] : "variable"

      assert(avgFrameDurationTicks !== undefined)
      assert(avgFrameDurationTicks !== "variable", "" + frameDurationTicks_s)
      const durationTicks = this.libav.i64tof64(
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
        avgFrameDurationTicks,
        durationSeconds: durationTicks * this.ticksToUsFactor / 1e6,
        numberOfFramesInStream: Math.round(durationTicks / avgFrameDurationTicks),
        avgFps: 1e6 / (avgFrameDurationTicks * this.ticksToUsFactor),
        startsWithIDRFrame,
        exactPts_s: "N/A",
      }
    }
  }

  async deinit() {
    if (this.libav !== null) {
      await this.libav.unlink(this.input.name);
      this.libav.terminate();
    }
  }

  async *getPackets(): AsyncGenerator<LibAVTypes.Packet, void, void> {
    if(this.playbackStarted) {
      throw new Error("Playback already started")
    }
    this.playbackStarted = true;
    let packets: LibAVTypes.Packet[] = []
    let endOfFile = false
    const pkt = await this.libav.av_packet_alloc()
    let firstIframePTS: number | undefined = undefined
    try {
      while (true) {
        if (endOfFile) {
          if (firstIframePTS === undefined) {
            throw new Error("Could not find any iFrames")
          }
          assert(packets.length === 0)
          return
        }
        const readMultiResult = await this.libav.ff_read_frame_multi(
          this.formatContext,
          pkt,
          { limit: .25 * 1024 * 1024 }
        );
        const resultCode = readMultiResult[0]
        endOfFile = resultCode === this.libav.AVERROR_EOF
        if (resultCode !== 0 && resultCode !== -this.libav.EAGAIN && !endOfFile) {
          throw new Error("Result is error: " + resultCode)
        }
        packets = [
          ...(readMultiResult[1][this.videoStream.index] ?? [])
          .filter(p => !((p.flags ?? 0) & Video.AV_PKT_FLAG_DISCARD))
          .reverse(),
          ...packets
        ]
        if (firstIframePTS === undefined) {
          const iFrames = packets.filter(
            p => !!((p.flags ?? 0) & Video.AV_PKT_FLAG_KEY))
          if (iFrames.length) {
            firstIframePTS = Math.min(...iFrames.map(p => 
          this.libav.i64tof64(p.pts!, p.ptshi!)))
          }
        }
        while (packets.length > 0) {
          const packet = packets.pop()!
          const pts = this.libav.i64tof64(packet.pts!, packet.ptshi!)
          if (pts < firstIframePTS!) {
            console.debug(`dropping packet with pts before first iFrame: ${pts} < ${firstIframePTS}`)
            continue
          }
          yield packet
        }
      }
    } finally {
      await this.libav.av_packet_free_js(pkt)
    }
  }

  async *getFrames(): AsyncGenerator<VideoFrame, void, void> {
    const frames: VideoFrame[] = []
    const videoDecoder = await this.getInitialisedVideoDecoder(frame => 
      frames.push(frame)
    )
    for await (const packet of this.getPackets()) {
      if ((packet.flags ?? 0) & Video.AV_PKT_FLAG_DISCARD) {
        continue
      }
      const pts = this.libav.i64tof64(packet.pts!, packet.ptshi!)
      const timestamp = Math.round(pts * this.ticksToUsFactor)
      const chunk = new EncodedVideoChunk({
        type: ((packet.flags ?? 0) & Video.AV_PKT_FLAG_KEY) ? "key" : "delta",
        timestamp,
        duration: 100,
        data: packet.data.buffer as ArrayBuffer,
      })
      videoDecoder.decode(chunk)
      while (videoDecoder.decodeQueueSize > 10) {
        await getPromiseFromEvent(videoDecoder, "dequeue")
      }
      while (frames.length) {
        yield frames.shift()!
      }
    }
    await videoDecoder.flush()
    while (frames.length) {
      yield frames.shift()!
    }
    return
  }

 async *getFrameInfoInPtsOrder(): AsyncGenerator<FrameInfo, void, void> {
    const decoderConfig = await LibAVWebcodecsBridge.videoStreamToConfig(
      this.libav, this.videoStream) as VideoDecoderConfig;

    const getSPSFromDescription = (): SpsCore | null => {
      if (decoderConfig.description === undefined) {
        return null
      }
      const description = (decoderConfig.description as Uint8Array)
      // see https://aviadr1.blogspot.com/2010/05/h264-extradata-partially-explained-for.html
      hexDump(description)
      const { record, remaining } = parseAvcDecoderConfigurationRecord(description);
      if (remaining.length > 0) {
        hexDump(description, 512)
        hexDump(remaining, 512)
        throw new Error("There should be no data remaining")
      }
      const spsCore = parseSpsNalUnit(record.sequenceParameterSets[0].data)
      return spsCore
    }

    const isAnnexB = !(decoderConfig.description ?? null)
    let currentSPS = getSPSFromDescription()
    let waitingFrameInfos: FrameInfo[] = []
    for await (const packet of this.getPackets()) {
      const frameInfoAndSPS = extractFrameInfo(
        this.libav, packet, isAnnexB, currentSPS)
      currentSPS = frameInfoAndSPS.currentSPS
      const frameInfo = frameInfoAndSPS.frameInfo
      if (frameInfo.isInterlacedStream && frameInfo.isInterlacedBottomSlice) {
        continue
      }
      waitingFrameInfos.push(frameInfo)
      const frameInfosReadyToSend = waitingFrameInfos.filter(fi => fi.pts <= frameInfo.dts)
      if (frameInfosReadyToSend.length) {
        waitingFrameInfos = waitingFrameInfos.filter(fi => fi.pts > frameInfo.dts)
      }
      for (const fi of frameInfosReadyToSend.sort((a, b) => a.pts - b.pts)) {
        yield(fi)
      }
    }
  }

 async getAllFrameInfo(
    progressCallback?: (progress: number) => void
  ): Promise<ReadonlyMap<number, FrameInfo>> {
    const result = new Map<number, FrameInfo>()
    for await (const [framenr, frameInfo]
    of enumerateAsyncGenerator(this.getFrameInfoInPtsOrder())) {
      //console.log(`nr ${framenr}: ${frameInfo.type}-frame at ${frameInfo.pts}`)
      result.set(framenr, frameInfo)
      if (progressCallback && (framenr % 100) === 0) {
        progressCallback(framenr / this.videoInfo.numberOfFramesInStream)
      }
    }
    return result
  }
}

/**
 * See https://github.com/Yahweasel/libavjs-webcodecs-bridge/issues/3#issuecomment-1837189047 for more info
 */
export async function createFakeKeyFrameChunk(
  width: number, height: number,
  decoderConfig: VideoDecoderConfig
): Promise<EncodedVideoChunk> {
  const { promise, resolve, reject } = promiseWithResolve<EncodedVideoChunk>();
  const encoderConfig = { ...decoderConfig } as VideoEncoderConfig;
  encoderConfig.width = width
  encoderConfig.height = height
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

export async function extractMetadata(file: File): Promise<VideoMetadata> {
  if (file.name.toLowerCase().endsWith(EXTENSIONS.videoFile.toLowerCase())) {
    const behaveData = await extractBehaveMetadata(file)
    if (ObjectKeys(behaveData).length) {
      const parsedBehaveData: {frameTypeInfo: Record<string, unknown>} & Record<string, unknown> = {
        exactPtsInSeconds_s: "N/A",
        frameTypeInfo: {},
      }
      for (const [key, value] of ObjectEntries(behaveData)) {
        const parsedValue = JSON.parse(value)
        switch (key) {
          case "iFrameInterval":
          case "iFrameStarts":
          case "idrFrameInterval":
          case "idrFrameStarts":
            parsedBehaveData.frameTypeInfo[key] = parsedValue
            break
          case "playbackFps":
            // was renamed
            parsedBehaveData.avgPlaybackFps = parsedValue
            break
          default:
            if (key in videoMetadataChecker.requiredItemChecker
              || key in videoMetadataChecker.optionalItemChecker) {
              parsedBehaveData[key] = parsedValue
            } else {
              // ignore extra metadata
            }
        }
      }
      if (videoMetadataChecker.isInstance(parsedBehaveData)) {
        return parsedBehaveData
      }
    }
    console.warn({behaveData})
    throw new Error("No metadata found, using an old video file?")
  } else if (file.name.toLowerCase().endsWith(EXTENSIONS.videoFileMp4.toLowerCase())) {
    const tags = await extractTags(file)
    const hash = await xxh64sum(file)
    const video = new Video(file)
    await video.init({keepFrameInfo: false})
    const numberOfFrames = video.videoInfo.numberOfFramesInStream
    const avgPlaybackFps = video.videoInfo.avgFps
    const exactPts_s = video.videoInfo.exactPts_s
    assert(exactPts_s !== "N/A")
    const exactPtsInSeconds_s = exactPts_s.map(
      pts => (pts - video.videoInfo.startTick) * video.ticksToUsFactor / 1e6)
    const creationTime  = [
      tags.format.tags.creation_time,
      ...tags.streams.map(s => s.tags.creation_time)
    ].filter(ct => !!ct)
    .map(ct => "isodate:" + ct)
    .filter(ct => ISODATETIMESTRINGREGEX.test(ct))
    .at(0) as ISODateTimeString | undefined
    const result: VideoMetadata = {
      hash,
      startTimestamps: creationTime !== undefined ? {"0": creationTime}: {},
      recordFps: avgPlaybackFps,
      frameTypeInfo: null,
      numberOfFrames,
      avgPlaybackFps,
      exactPtsInSeconds_s,
    }
    return result
  }
  throw new Error("TODO: " + file.name)
}

export type Tags = {
  programs: Array<unknown>,
  streams: Array<{
    index: number
    codec_type: "video" | "audio" | "data" | "subtitle"
    tags: Record<string, string>
  }>
  format: {
    tags: Record<string, string>
  }
}
const validateTags: Checker<Tags> = getCheckerFromObject({
  programs: new ArrayChecker(new UnknownChecker()),
  streams: new ArrayChecker({
    index: 1,
    codec_type: new LiteralChecker(["video", "audio", "data", "subtitle"]),
    tags: new RecordChecker({keyChecker: new StringChecker(), valueChecker: new StringChecker()}),
  }),
  format: {
    tags: new RecordChecker({keyChecker: new StringChecker(), valueChecker: new StringChecker()}),
  }
})

export async function extractTags(file: File): Promise<Tags> {
  let libav: LibAVTypes.LibAV | undefined = undefined
  let writtenData = new Uint8Array(0);
  try {
    const FFMPEGOUTPUT = "__ffmpeg_output__";
    const LibAV = await getLibAV()
    libav = await LibAV.LibAV({ noworker: false, nothreads: true });
    assert(libav !== undefined)
    await libav.mkreadaheadfile(file.name, file);
    await libav.mkwriterdev(FFMPEGOUTPUT);
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
      "-hide_banner",
      "-loglevel", "error",
      "-i", file.name,
      "-print_format", "json",
      "-show_entries", "stream=index,codec_type:stream_tags:format_tags",
      "-o", FFMPEGOUTPUT,
    );
    if (exit_code != 0) {
      throw new Error(`ffprobe exit code: ${exit_code}`);
    }
    await libav.unlink(file.name);
    await libav.unlink(FFMPEGOUTPUT);
  } finally {
    if (libav !== undefined) {
      libav.terminate()
    }
  }
  const output = new TextDecoder("utf-8").decode(writtenData);
  const tags = JSON.parse(output)
  if (!validateTags.isInstance(tags)) {
  throw new Error("Error getting tags")
  }
  return tags
}

export async function extractBehaveMetadata(file: File): Promise<Record<string, string>> {
  let libav: LibAVTypes.LibAV | undefined = undefined
  let writtenData = new Uint8Array(0);
  try {
    const FFMPEGOUTPUT = "__ffmpeg_output__";
    const LibAV = await getLibAV()
    libav = await LibAV.LibAV({ noworker: false, nothreads: true });
    assert(libav !== undefined)
    await libav.mkreadaheadfile(file.name, file);
    await libav.mkwriterdev(FFMPEGOUTPUT);
    libav.onwrite = function (_name, pos, data) {
      const newLen = Math.max(writtenData.length, pos + data.length);
      if (newLen > writtenData.length) {
        const newData = new Uint8Array(newLen);
        newData.set(writtenData);
        writtenData = newData;
      }
      writtenData.set(data, pos);
    };
    const exit_code = await libav.ffmpeg(
      "-hide_banner",
      "-loglevel", "error",
      "-i", file.name,
      "-f", "ffmetadata",
      "-y", FFMPEGOUTPUT,
    );
    if (exit_code != 0) {
      throw new Error(`ffmpeg exit code: ${exit_code}`);
    }
    await libav.unlink(file.name);
    await libav.unlink(FFMPEGOUTPUT);
  } finally {
    if (libav !== undefined) {
      libav.terminate()
    }
  }
  const output = new TextDecoder("utf-8").decode(writtenData);
  const behaveData: Record<string, string> = {}
  for (const line of output.split("\n")) {
    if (line.startsWith("BEHAVE:")) {
      const eqPos = line.indexOf("=")
      const key = line.slice("BEHAVE:".length, eqPos)
      const value = line.slice(eqPos + 1)
      behaveData[key] = value
    }
  }
  return behaveData
}


const PROGRESSFILENAME = "__progress__"

const getCompressedFrameInfo = (
  frameInfo: ReadonlyMap<number, FrameInfo>
): {
  recordFps: number,
  startTimestamps: Record<number, ISODateTimeString>
  iFrameInterval: number,
  iFrameStarts: number[],
  idrFrameInterval: number | null,
  idrFrameStarts: number[],
} => {
  const timestamps = new Map(
    [...frameInfo.entries()].filter(
      ([_, frameInfo]) => frameInfo.timestamp !== undefined).map(
        ([framenr, frameInfo]) => [framenr, frameInfo.timestamp!] as const))
  if (timestamps.size < 2) {
    throw new Error("Not enough timestamps can be found, "
    + "maybe file is not supported")
  }
  const timestampEntries = [...timestamps.entries()]
  const frameNrAndTimestampParts = timestampEntries.map(
    ([framenr, isots]) => [framenr, getPartsFromTimestamp(isots)] as const)
  const tzs = new Set(frameNrAndTimestampParts.map(([_, parts]) => parts.tz))
  if (tzs.size != 1) {
    throw new Error("The timezone changes halfway the video, this is TODO: "
      + JSON.stringify([...tzs]))
  }
  const [firstFrameNumber, firstParts] = frameNrAndTimestampParts.at(0)!
  const [lastFrameNumber, lastParts] = frameNrAndTimestampParts.at(-1)!
  const recordTimeFramesPerSecond = (lastFrameNumber - firstFrameNumber) / ((lastParts.date.valueOf() - firstParts.date.valueOf()) / 1000)
  console.log(`Real recordFPS = ${recordTimeFramesPerSecond}`)

  /*
   * Getting the timestamps right is a bit tricky.
   * The timestamps (from MTS) are datetimes rounded to whole seconds
   * If the record FPS = 25, we naively assume that the first 25 frames
   * have the starting timestamp.
   * However some smarts are present that if frame 12 has a next second timestamp,
   * we retroactively connect the first timestamp to frame -13, so that frame 12 still has the right timestamp.
   * 
   * An alternative would be to choose a framenr for the start timestamp such that you have the smallest error over all timestamps in the recording.
   * However this may not work, since there may be record framerates of 30000/1001 or something, so there is a small shift in timestamps over time. We record the record FPS as a whole number.
   *
   */
  const wholeRecordTimeFramesPerSecond = Math.round(recordTimeFramesPerSecond)
  if (Math.abs(recordTimeFramesPerSecond - wholeRecordTimeFramesPerSecond) > .05) {
    throw new Error("non-int record frames per second is not yet supported, TODO: "
    + recordTimeFramesPerSecond)
  }
  if (wholeRecordTimeFramesPerSecond === 0) {
    throw new Error("Record FPS is under 0.5; at the moment we don't support this yet. TODO: " + recordTimeFramesPerSecond)
  }
  const newTSs = [[firstFrameNumber, firstParts] as const]
  let possibleOffset = wholeRecordTimeFramesPerSecond - 1
  for (const [framenr, parts] of frameNrAndTimestampParts) {
    const [lastTSFramenr, lastTSParts] = newTSs.at(-1)!
    offsetloop: for (let offset = 0; offset <= possibleOffset; offset++) {
    const expectedTimestamp = lastTSParts.date.valueOf() + 1000 * Math.floor((framenr - lastTSFramenr + offset) / wholeRecordTimeFramesPerSecond )
      if (expectedTimestamp === parts.date.valueOf()) {
        if (offset !== 0) {
          const oldTS = newTSs.pop()!
          const newTS = [oldTS[0] - offset, oldTS[1]] as const
          while (newTSs.length && newTS[0] <= newTSs.at(-1)![0]) {
            if(newTSs.at(-1)![1].valueOf() !== newTS[1].date.valueOf()) {
              console.warn(`Weird date stuff: ${framenr} has ${parts.date.toISOString()}; last ${newTSs.at(-1)![0]}: ${newTSs.at(-1)![1].date.toISOString()}`)
              continue offsetloop
            }
            const [oldframe, oldpart] = newTSs.pop()!
            console.log(`${framenr}, ${parts.date.toISOString()}, ${offset} replacing previous ${oldframe}, ${oldpart.date.toISOString()}`)
          }
          newTSs.push(newTS)
          possibleOffset -= offset
          console.log(`${framenr}: moving framenr by ${offset} (${possibleOffset})`)
        }
        break
      }
      if (offset === possibleOffset) {
        console.log(`${framenr}: newts ${parts.date.toISOString()}`)
        newTSs.push([framenr, parts])
        possibleOffset = wholeRecordTimeFramesPerSecond - 1
        break
      }
    }
  }
  newTSs.forEach(([nr, parts]) => console.log(nr, parts.date.toISOString()))

  const iFrames = [...frameInfo.entries()].filter(
    ([_, frameInfo]) => frameInfo.type === "I" || frameInfo.type === "IDR").map(
    ([framenr]) => framenr)
  const idrFrames = [...frameInfo.entries()].filter(
    ([_, frameInfo]) => frameInfo.type === "IDR").map(([framenr]) => framenr)

  const getIntervalAndStarts = (list: number[]): [number, number[]] => {
    if (list.length === 0) {
      return [NaN, []]
    }
    if (list.length === 1) {
      return [NaN, [...list]]
    }
    const intervals: number[] = []
    for (let i = 1; i < list.length; i++) {
      intervals.push(list[i] - list[i - 1])
    }
    const maxInterval = Math.max(...intervals)
    const startIndices = [0, ...intervals.map((interval, idx) => [interval, idx])
      .filter(([interval]) => interval !== maxInterval).map(([_, idx]) => idx)]
    return [maxInterval, startIndices.map(i => list[i])]
  }

  const [iFrameInterval, iFrameStarts] = getIntervalAndStarts(iFrames)
  const [idrFrameInterval, idrFrameStarts] = getIntervalAndStarts(idrFrames)

  const nonFiniteToNull = (x: number): number | null => {
    return Number.isFinite(x) ? x : null
}

  const frameTypeInfo = {
    iFrameInterval: nonFiniteToNull(iFrameInterval),
    iFrameStarts,
    idrFrameInterval: nonFiniteToNull(idrFrameInterval),
    idrFrameStarts,
  }

  definiteFrameTypeInfoChecker.assertInstance(frameTypeInfo);
  
  const result = {
    recordFps: wholeRecordTimeFramesPerSecond,
    startTimestamps: ObjectFromEntries(newTSs.map(
      ([framenr, parts]) => [framenr.toString(), partsToIsoDate(parts)])),
    ...frameTypeInfo,
  }

  return result
}

export async function convert(
  input: {file: File},
  output: {dir: FileSystemDirectoryHandle},
  forceOverwrite: boolean,
  onProgress: (progress: FileTreeLeaf["progress"]) => void
) {

  const updateProgress = (step: "timestamps" | "convert", progress: number) => {
    const DURATIONS: {[key in Parameters<typeof updateProgress>[0]]: number} = {
      timestamps: 1,
      convert: 1,
    }
    let sumProgress = 0
    for (const [key, value] of ObjectEntries(DURATIONS)) {
      if (key === step) {
        sumProgress += value * progress
        break
      }
      sumProgress += value
    }
    const sum = Object.values(DURATIONS).reduce((a, b) => a + b)
    onProgress({"converting": sumProgress / sum})
  }
  onProgress({"converting": 0})

  let outputfilename: string | undefined = undefined
  let outputstream: FileSystemWritableFileStream | undefined = undefined
  let video: Video | undefined = undefined
  let libav: LibAVTypes.LibAV | undefined = undefined

  try {
    const parts = input.file.name.split(".")
    const base = (parts.length == 1 ? parts : parts.slice(0, -1)).join(".")
    const hash = await xxh64sum(input.file)
    outputfilename = [base, ".", hash, EXTENSIONS.videoFile].join("")
    if (!forceOverwrite
      && await nonEmptyFileExists(output.dir, outputfilename.split("/"))) {
      onProgress("target_exists")
      return
    }
    const outfile = await output.dir.getFileHandle(outputfilename, {create: true})
    outputstream = await outfile.createWritable()

    video = new Video(input.file)
    await video.init({keepFrameInfo: true})
    const frameInfo = await video.getAllFrameInfo(progress => {
      updateProgress("timestamps", progress)
    })
    const compressedFrameInfo = getCompressedFrameInfo(frameInfo)

    const durationSeconds = video.videoInfo.durationSeconds

    const LibAV = await getLibAV()
    libav = await LibAV.LibAV({noworker: false, nothreads: true});
    assert(libav !== undefined)
    await libav.mkreadaheadfile(input.file.name, input.file)
    await libav.mkwriterdev(outputfilename)
    await libav.mkstreamwriterdev(PROGRESSFILENAME)
    const writePromises: Set<Promise<unknown>> = new Set()
    let progressController = null as ReadableStreamDefaultController<Uint8Array> | null
    const progressStream = new ReadableStream({
      start(controller) {
        progressController = controller
      }
    }).pipeThrough(new TextDecoderStream())
    libav.onwrite = function(name, pos, data) {
      assert(progressController)
      if (name === PROGRESSFILENAME) {
        progressController.enqueue(data as Uint8Array)
        return
      }
      const promise = outputstream!.write(
        {type: "write", data: data.slice(0), position: pos})
      writePromises.add(promise)
      void(promise.then(() => {writePromises.delete(promise)}))
    }
    let progressStreamLeftOver = ""
    void(progressStream.pipeTo(new WritableStream({
      write(chunk: string) {
        const parts = (progressStreamLeftOver + chunk).split("\n")
        progressStreamLeftOver = parts.slice(-1)[0]
        const lines = parts.slice(0, -1)
        for (const line of lines) {
          const [key, value] = line.split("=")
          if (key  === "out_time_us") {
            const outTimeSeconds = parseInt(value) / 1_000_000
            if (!Number.isNaN(outTimeSeconds)) {
              updateProgress("convert", 
                Math.max(0, Math.min(outTimeSeconds / durationSeconds, 1)))
            }
          }
        }
      }
    })))

    const metadata = {
      ...compressedFrameInfo,
      avgPlaybackFps: video.videoInfo.avgFps,
      startTick: video.videoInfo.startTick,
      numberOfFrames: video.videoInfo.numberOfFramesInStream,
      hash,
    }


    assert(/^[0-9a-fA-F]{16}$/.test(hash))
    const exit_code = await libav.ffmpeg(
      "-i", input.file.name,
      "-nostdin",
      "-c:v", "copy",
      "-an",
      "-hide_banner",
      "-loglevel", "error",
      "-movflags", "use_metadata_tags",
      ...ObjectEntries(metadata).flatMap(([key, value]) => [
        "-metadata", `BEHAVE:${key}=${JSON.stringify(value)}`]),
      "-progress", PROGRESSFILENAME,
      "-y", outputfilename
    )
    await Promise.all(writePromises)
    await libav.unlink(input.file.name)
    await libav.unlink(outputfilename)
    await libav.unlink(PROGRESSFILENAME)
    if (progressController) {
      progressController.close()
    }
    if (exit_code != 0) {
      throw new Error(`ffmpeg exit code: ${exit_code}`)
    }
    onProgress({converting: 1})
    await outputstream.close()
    onProgress("done")
  } catch(e) {
    if (outputstream && outputfilename !== undefined) {
      await outputstream.close()
      await output.dir.removeEntry(outputfilename)
      outputfilename = undefined
      outputstream = undefined
    }
    throw e
  } finally {
    if (libav) {
      libav.terminate()
    }
    if (video) {
      await video.deinit()
    }
  }
}
