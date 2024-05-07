import { xxh64sum } from '../lib/fileutil'
import {nonEmptyFileExists, type FileTreeLeaf} from "../lib/FileTree"
import { getPartsFromTimestamp, partsToIsoDate, ISODateTimeString, ISODATETIMESTRINGREGEX } from "../lib/datetime"
import { EXTENSIONS } from '../lib/constants'
import { getLibAV, type LibAVTypes } from "../lib/libavjs"

import {ObjectEntries, ObjectFromEntries, assert, promiseWithResolve, ObjectKeys} from "../lib/util"
import * as LibAVWebcodecsBridge from "libavjs-webcodecs-bridge";
import { VideoMetadata, videoMetadataChecker, } from '../lib/video-shared'
import { ArrayChecker, Checker, LiteralChecker, RecordChecker, StringChecker, UnknownChecker, getCheckerFromObject } from '../lib/typeCheck'
import { FrameInfo, extractFrameInfo } from "./frameinfo"

type VideoInfo = {
  // the pts of the first frame
  readonly startTick: number,
  // the pts of the last frame
  readonly endTick: number,
  // basically endtick - starttick
  readonly durationTicks: number,
  // number of ticks that one frame takes
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
  // true if packets are annexB encoded
  readonly isAnnexB: boolean,
  readonly videoStream: LibAVTypes.Stream
}

const DEFAULT_LIBAV_OPTIONS: LibAVTypes.LibAVOpts = {
  noworker: false,
  nothreads: false,
  yesthreads: true,
} as const;

async function codecIsAnnexB(libav: LibAVTypes.LibAV, codecpar: number): Promise<boolean> {
    const extradataPtr = await libav.AVCodecParameters_extradata(codecpar);
    const hasExtradata = (extradataPtr !== 0)
    && (await libav.AVCodecParameters_extradata_size(codecpar) > 0)
    return !hasExtradata
}

function findVideoStream (
  libav: LibAVTypes.LibAV, streams: ReadonlyArray<LibAVTypes.Stream>
): LibAVTypes.Stream {
  const video_streams: LibAVTypes.Stream[] = streams.filter(
    (s) => s.codec_type === libav.AVMEDIA_TYPE_VIDEO
  )
  if (video_streams.length !== 1) {
    throw new Error(
      `Problem with file, contains ${video_streams.length} video streams: ${video_streams}`
    );
  }
  return video_streams[0]
}



type Context = {
  videoStream: LibAVTypes.Stream
}
type Options = {
  libav?: LibAVTypes.LibAV
  context?: Context
}

export async function* getVideoPackets(file: File, options?: Options): AsyncGenerator<LibAVTypes.Packet> {
  yield* getVideoPacketsOrFrames("packets", file, options) as AsyncGenerator<LibAVTypes.Packet>
}

export async function* getVideoFrames(file: File, options?: Options): AsyncGenerator<LibAVTypes.Frame> {
  yield* getVideoPacketsOrFrames("frames", file, options) as AsyncGenerator<LibAVTypes.Frame>
}

export async function* getImageDatas(file: File, options?: Options & {width: number, height: number}): AsyncGenerator<ImageData> {
  yield* getVideoPacketsOrFrames("imageData", file, options) as AsyncGenerator<ImageData>
}

async function* getVideoPacketsOrFrames(type: "packets" | "frames" | "imageData", file: File, options?: Options): AsyncGenerator<LibAVTypes.Packet | LibAVTypes.Frame | ImageData> {
  const libav = options?.libav ?? await(await getLibAV()).LibAV(DEFAULT_LIBAV_OPTIONS)
  try {
    await libav.av_log_set_level(libav.AV_LOG_ERROR)
    await libav.mkreadaheadfile(file.name, file)
    const [fmt_ctx, streams] = await libav.ff_init_demuxer_file(file.name)
    const videoStream = findVideoStream(libav, streams)
    if (options) {
      options.context = {videoStream}
    }
    const [, code_ctx, pkt_ptr, frame_ptr] = type === "packets"
    ? [null, 0, await libav.av_packet_alloc(), 0]
    : await libav.ff_init_decoder(videoStream.codec_id, videoStream.codecpar)
    const input: LibAVTypes.FilterIOSettings = {
    type: libav.AVMEDIA_TYPE_VIDEO,
    width: 1920,
      height: 1080,
    time_base: [videoStream.time_base_num, videoStream.time_base_den],
    }
    const output: LibAVTypes.FilterIOSettings = {
    type: libav.AVMEDIA_TYPE_VIDEO,
    width: 640,
      height: 640,
    pix_fmt: libav.AV_PIX_FMT_RGBA
    }
    const [_, source_ctx, sink_ctx] = type === "imageData"
      ? await libav.ff_init_filter_graph("scale=640x640:force_original_aspect_ratio=decrease", input, output)
      : [0, 0, 0]
    let endOfFile = false
    while (!endOfFile) {
      const [result, packets] = await libav.ff_read_frame_multi(
        fmt_ctx,
        pkt_ptr,
        { limit: 1024 * 1024 }
      );
      endOfFile = result === libav.AVERROR_EOF
      if (type === "packets") {
        for (const packet of packets[videoStream.index]) {
          yield packet
        }
      } else if (type === "frames") {
        const frames = await libav.ff_decode_multi(
          code_ctx, pkt_ptr, frame_ptr, packets[videoStream.index],
          {fin: endOfFile})
        for (const frame of frames) {
          yield frame
        }
      } else {
        assert(type === "imageData")
        const imageDatas = await libav.ff_decode_filter_multi(
          code_ctx, source_ctx, sink_ctx, pkt_ptr, frame_ptr, packets[videoStream.index],
          {fin: endOfFile, copyoutFrame: "ImageData"})
        for (const imageData of imageDatas) {
          yield imageData
        }
      }
      if (result !== 0 && result !== -libav.EAGAIN && !endOfFile) {
        throw new Error("Result is error: " + result)
      }
    }
  } finally {
    if (!options?.libav) {
      libav.terminate();
    }
  }
}

export async function getVideoInfo(file: File, options?: {libav?: LibAVTypes.LibAV}): Promise<VideoInfo> {
  const libav = options?.libav ?? await(await getLibAV()).LibAV(DEFAULT_LIBAV_OPTIONS)
  try {
    const options: Options = {libav}
    const frames = getVideoFrames(file, options)
    const NR_GOPS_TO_CHECK = 2

    let startTick: number | undefined = undefined
    const frameDurationTicks_s: number[] = []
    let maxGopLength: number | undefined = undefined
    let gopLength: number = 0
    let gopCount = 0
    let lastFrameTimestamp: number | undefined = undefined


    for await (const frame of frames) {
      const pts = libav.i64tof64(frame.pts!, frame.ptshi!)
      const isKeyFrame = (frame.key_frame ?? 0) ? true : false
      if (isKeyFrame) {
        if (gopCount > 0) {
          maxGopLength = Math.max(maxGopLength ?? 0, gopLength)
        }
        gopLength = 0
        gopCount++
      } else {
        if (gopCount === 0) {
          console.info("Ignoring pre-first-keyframe-frame")
          continue
        }
      }
      if (gopCount > NR_GOPS_TO_CHECK) {
        break
      }
      if (startTick === undefined) {
        startTick = pts
      }
      if (lastFrameTimestamp !== undefined) {
        const sinceLastFrameTicks = pts - lastFrameTimestamp
        frameDurationTicks_s.push(sinceLastFrameTicks)
      }
      gopLength++
      lastFrameTimestamp = pts
    }
    if (gopCount <= NR_GOPS_TO_CHECK) {
      throw new Error(`Pfff, file with fewer than {$NR_GOPS_TO_CHECK} GOPs (${gopCount}....`)
    }

    const videoStream = options.context!.videoStream
    console.log({videoStream})
    const frameDurationTicks = (new Set(frameDurationTicks_s).size === 1)
      ? frameDurationTicks_s[0] : "variable"

    assert(startTick !== undefined)
    assert(frameDurationTicks !== undefined)
    assert(maxGopLength !== undefined)
    assert(frameDurationTicks !== "variable", "" + frameDurationTicks_s)
    const durationTicks = libav.i64tof64(
      await libav.AVStream_duration(videoStream.ptr),
      await libav.AVStream_durationhi(videoStream.ptr),
    )

    const isAnnexB = await codecIsAnnexB(libav, videoStream.codecpar)
    const endTick = startTick + durationTicks
    const ticksToUsFactor = 
      1e6 * videoStream.time_base_num / videoStream.time_base_den

    return {
      startTick,
      endTick,
      durationTicks,
      frameDurationTicks,
      maxGopLength,
      startSecond: startTick * ticksToUsFactor / 1e6,
      endSecond: endTick * ticksToUsFactor / 1e6,
      durationSeconds: durationTicks * ticksToUsFactor / 1e6,
      frameDurationSeconds: frameDurationTicks * ticksToUsFactor / 1e6,
      numberOfFramesInStream: Math.round(durationTicks / frameDurationTicks),
      fps: 1e6 / (frameDurationTicks * ticksToUsFactor),
      isAnnexB,
      videoStream,
    }
  } finally {
    if (!options?.libav) {
      libav.terminate();
    }
  }
}

// export class Video {
//   static FRAME_CACHE_MAX_SIZE = 5 as const;
//   static VIDEO_DEQUEUE_QUEUE_MAX_SIZE = 24 as const;
//   static FAKE_FIRST_FRAME_TIMESTAMP = Number.MIN_SAFE_INTEGER;
//   public readonly formatContext = null as unknown as number
//   public readonly codeContext = null as unknown as number
//   public readonly videoStream = null as unknown as LibAVTypes.Stream
//   public readonly videoInfo = null as unknown as VideoInfo
//   public readonly ticksToUsFactor: number = null as unknown as number;
//   private cacheFillerRunning = false
//
//   private constructor(
//     public readonly libav: LibAVTypes.LibAV,
//     public readonly input: File
//   ) { }
//
//   async init(): Promise<{consumedPackets: ReadonlyArray<LibAVTypes.Packet>, consumedFrames: ReadonlyArray<LibAVTypes.Frame>}> {
//     const _rwthis = this as {
//       -readonly [K in keyof typeof this]: typeof this[K]
//     }
//     await this.libav.av_log_set_level(this.libav.AV_LOG_ERROR);
//     await this.libav.mkreadaheadfile(this.input.name, this.input);
//     const [fmt_ctx, streams] = await this.libav.ff_init_demuxer_file(
//       this.input.name
//     );
//     const video_streams: LibAVTypes.Stream[] = streams.filter(
//       (s) => s.codec_type === this.libav.AVMEDIA_TYPE_VIDEO
//     );
//     if (video_streams.length !== 1) {
//       throw new Error(
//         `Problem with file ${this.input.name}, contains ${video_streams.length} video streams: ${video_streams}`
//       );
//     }
//     const [, code_ctx, pkt, frame] = await this.libav.ff_init_decoder(video_streams[0].codec_id, video_streams[0].codecpar)
//     await this.libav.av_packet_free_js(pkt)
//     await this.libav.av_frame_free_js(frame)
//     _rwthis.formatContext = fmt_ctx;
//     _rwthis.codeContext = code_ctx;
//     _rwthis.videoStream = video_streams[0];
//     _rwthis.ticksToUsFactor = 
//       1e6 * this.videoStream.time_base_num / this.videoStream.time_base_den
//     return await this.setVideoInfo()
//   }
//
//   private async setVideoInfo() {
//     // NOTE: this will not work if it's not called as the very first thing after
//     // the file is loaded
//     const consumedPackets: Array<LibAVTypes.Packet> = []
//     const consumedFrames: Array<LibAVTypes.Frame> = []
//     const NR_GOPS_TO_CHECK = 2
//
//     const keyFrameUs_s = new Set<number>()
//
//     let startTick: number | undefined = undefined
//     const frameDurationTicks_s: number[] = []
//     let maxGopLength: number | undefined = undefined
//     let gopLength: number = 0
//     let gopCount = 0
//     let lastFrameTimestamp: number | undefined = undefined
//
//
//     const frameptr = await this.libav.av_frame_alloc()
//     const pktptr = await this.libav.av_packet_alloc()
//     packetreader: while (true) {
//       const {endOfFile, videoPackets} = await this.doReadMulti()
//       const frames = await this.libav.ff_decode_multi(this.codeContext, pktptr, frameptr, videoPackets, {fin: endOfFile})
//       consumedPackets.push(...videoPackets)
//       consumedFrames.push(...frames)
//       for (const packet of videoPackets) {
//         const isKeyFrame = (packet.flags ?? 0) & this.libav.AV_PKT_FLAG_KEY
//         const pts = this.libav.i64tof64(packet.pts!, packet.ptshi!)
//         if (isKeyFrame) {
//           keyFrameUs_s.add(pts)
//         }
//         if (keyFrameUs_s.size === 0) {
//           console.debug("Skipping pre-first-keyframe-frames")
//           continue
//         }
//       }
//       for (const frame of frames) {
//         const pts = this.libav.i64tof64(frame.pts!, frame.ptshi!)
//         const isKey = keyFrameUs_s.has(pts)
//         if (isKey) {
//           if (gopCount > 0) {
//             maxGopLength = Math.max(maxGopLength ?? 0, gopLength)
//           }
//           gopLength = 0
//           gopCount++
//         }
//         if (gopCount > NR_GOPS_TO_CHECK) {
//           break packetreader
//         }
//         if (startTick === undefined) {
//           startTick = pts
//         }
//         if (lastFrameTimestamp !== undefined) {
//           const sinceLastFrameTicks = pts - lastFrameTimestamp
//           frameDurationTicks_s.push(sinceLastFrameTicks)
//         }
//         gopLength++
//         lastFrameTimestamp = pts
//       }
//       if (endOfFile) {
//         throw new Error("Pfff, file with fewer than two GOPs....")
//       }
//     }
//
//     const frameDurationTicks = (new Set(frameDurationTicks_s).size === 1)
//       ? frameDurationTicks_s[0] : "variable"
//
//     assert(startTick !== undefined)
//     assert(frameDurationTicks !== undefined)
//     assert(maxGopLength !== undefined)
//     assert(frameDurationTicks !== "variable", "" + frameDurationTicks_s)
//     const durationTicks = this.libav.i64tof64(
//       await this.libav.AVStream_duration(this.videoStream.ptr),
//       await this.libav.AVStream_durationhi(this.videoStream.ptr),
//     )
//     const endTick = startTick + durationTicks
//     // some magic to write to readonly property
//     const decoderConfig = await LibAVWebcodecsBridge.videoStreamToConfig(
//       this.libav, this.videoStream) as VideoDecoderConfig;
//     const isAnnexB = !(decoderConfig.description ?? null)
//     const _rwthis = this as {-readonly [K in keyof typeof this]: typeof this[K]}
//     _rwthis.videoInfo = {
//       startTick,
//       endTick,
//       durationTicks,
//       frameDurationTicks,
//       maxGopLength,
//       startSecond: startTick * this.ticksToUsFactor / 1e6,
//       endSecond: endTick * this.ticksToUsFactor / 1e6,
//       durationSeconds: durationTicks * this.ticksToUsFactor / 1e6,
//       frameDurationSeconds: frameDurationTicks * this.ticksToUsFactor / 1e6,
//       numberOfFramesInStream: Math.round(durationTicks / frameDurationTicks),
//       fps: 1e6 / (frameDurationTicks * this.ticksToUsFactor),
//       isAnnexB,
//     }
//     return {consumedPackets, consumedFrames}
//   }
//
//   async deinit() {
//     if (this.libav !== null) {
//       await this.libav.unlink(this.input.name);
//       await this.libav.avformat_close_input_js(this.formatContext)
//       this.libav.terminate();
//     }
//   }
//
//   async* getPackets(): AsyncGenerator<LibAVTypes.Packet> {
//     const pkt = await this.libav.av_packet_alloc()
//     const [result, packets] = await this.libav.ff_read_frame_multi(
//       this.formatContext,
//       pkt,
//       { limit: 1024 * 1024 }
//     );
//     await this.libav.av_packet_free_js(pkt)
//     const endOfFile = result === this.libav.AVERROR_EOF
//     if (result !== 0 && result !== -this.libav.EAGAIN && !endOfFile) {
//       throw new Error("Result is error: " + result)
//     }
//     return {endOfFile, videoPackets: packets[this.videoStream.index] ?? []}
//   }
//
//   async getAllFrameInfo(
//     progressCallback?: (progress: number) => void
//   ): Promise<ReadonlyMap<number, FrameInfo>> {
//     const result = new Map<number, FrameInfo>()
//     const isAnnexB = this.videoInfo.isAnnexB
//     const startTick = this.videoInfo.startTick
//     const frameDurationTicks = this.videoInfo.frameDurationTicks
//     const totalNumberOfFrames = this.videoInfo.numberOfFramesInStream
//     await this.packetStreamSeek(0)
//     for (let i=0; ; i++) {
//       const packet = await this.packetStreamNext()
//       if (!packet) break
//       const frameInfo = extractFrameInfo(packet, isAnnexB)
//       const pts = this.libav.i64tof64(packet.pts!, packet.ptshi!)
//       const dts = this.libav.i64tof64(packet.dts!, packet.dtshi!)
//       const framenr = (pts - startTick) / frameDurationTicks
//       if (framenr % 1 !== 0) {
//         // half frame in interlaced or existing fraeme
//         continue
//       }
//       assert(!result.has(framenr))
//       const fullFrameInfo = {...frameInfo, pts, dts}
//       result.set(framenr, fullFrameInfo)
//       if (progressCallback && (i % 100) === 0) {
//         const pts = this.libav.i64tof64(packet.pts!, packet.ptshi!)
//         const framenr = (pts - startTick) / frameDurationTicks
//         progressCallback(framenr / totalNumberOfFrames)
//       }
//     }
//     return result
//   }
//
//   static async* getPacketsFromFile(file: File): AsyncGenerator<LibAVTypes.Packet> {
//     const libav = await (await getLibAV()).LibAV(Video.DEFAULT_LIBAV_OPTIONS)
//     const video = new Video(libav, file)
//     const {consumedPackets} = await video.init()
//     for (const packet of consumedPackets) {
//       yield packet
//     }
//   }
//
//   async* getFramesFromFile(): AsyncGenerator<LibAVTypes.Frame> {
//     throw new Error("TODO")
//     yield "" as unknown as LibAVTypes.Frame
//   }
// }

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
  encoderConfig.width = 1280;
  encoderConfig.height = 720;
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
    const playbackFps = video.videoInfo.fps
    const creationTime  = [
      tags.format.tags.creation_time,
      ...tags.streams.map(s => s.tags.creation_time)
    ].filter(ct => ct)
    .map(ct => "isodate:" + ct)
    .filter(ct => ISODATETIMESTRINGREGEX.test(ct))
    .at(0) as ISODateTimeString | undefined
    const result: VideoMetadata = {
      hash,
      startTimestamps: creationTime !== undefined ? {"0": creationTime}: {},
      recordFps: playbackFps,
      frameTypeInfo: null,
      numberOfFrames,
      playbackFps,
    }
    console.log(JSON.stringify(result))
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
  idrFrameInterval: number,
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
  
  return {
    recordFps: wholeRecordTimeFramesPerSecond,
    startTimestamps: ObjectFromEntries(newTSs.map(
      ([framenr, parts]) => [framenr.toString(), partsToIsoDate(parts)])),
    iFrameInterval,
    iFrameStarts,
    idrFrameInterval,
    idrFrameStarts,
  }
}

export async function convert(
  input: {file: File},
  output: {dir: FileSystemDirectoryHandle},
  onProgress: (progress: FileTreeLeaf["progress"]) => void
) {

  const updateProgress = (step: "hash" | "timestamps" | "convert", progress: number) => {
    const DURATIONS: {[key in Parameters<typeof updateProgress>[0]]: number} = {
      hash: .1,
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
    const baseparts = parts.length == 1 ? parts : parts.slice(0, -1)
    const hash = await xxh64sum(input.file, progress => updateProgress(
      "hash", progress))
    outputfilename = [...baseparts, ".", hash, EXTENSIONS.videoFile].join("")
    if (await nonEmptyFileExists(output.dir, outputfilename.split("/"))) {
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
    let progressController = null as ReadableStreamDefaultController<ArrayBuffer> | null
    const progressStream = new ReadableStream({
      start(controller) {
        progressController = controller
      }
    }).pipeThrough(new TextDecoderStream())
    libav.onwrite = function(name, pos, data) {
      assert(progressController)
      if (name === PROGRESSFILENAME) {
        progressController.enqueue(data)
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
      playbackFps: video.videoInfo.fps,
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
    libav && libav.terminate()
    video && await video.deinit()
  }
}
