import type * as LibAVTypes from "../../public/app/bundled/libavjs/dist/libav.types";
import {assert} from "./util"
import * as LibAVWebcodecsBridge from "libavjs-webcodecs-bridge";
declare global {
  interface Window {
    LibAV: LibAVTypes.LibAVWrapper;
  }
}
import { getPromiseFromEvent } from "./util";

export class Video {
  static DEFAULT_LIBAV_OPTIONS: LibAVTypes.LibAVOpts = {
    noworker: false,
    nothreads: true,
  } as const;
  static FRAME_CACHE_MAX_SIZE = 5 as const;
  static VIDEO_DEQUEUE_QUEUE_MAX_SIZE = 24 as const;
  static FAKE_FIRST_FRAME_TIMESTAMP = Number.MIN_SAFE_INTEGER;
  private _libav: LibAVTypes.LibAV = null as unknown as LibAVTypes.LibAV;
  private _formatContext: number | null = null;
  private _videoStream: LibAVTypes.Stream | null = null;
  private _frameCache: VideoFrame[];
  private _nextIsDummyFrame: boolean = false;
  private _videoDecoder: VideoDecoder = null as unknown as VideoDecoder;

  constructor(public readonly input: File) {
    this._frameCache = [];
  }

  get libav() {
    if (!this._libav) {
      throw "Run init() first";
    }
    return this._libav;
  }

  get videoStream() {
    if (!this._videoStream) {
      throw "Run init() first";
    }
    return this._videoStream;
  }

  get formatContext() {
    if (this._formatContext === null) {
      throw "Run init() first";
    }
    return this._formatContext;
  }

  async init(options?: { libavoptions?: LibAVTypes.LibAVOpts }) {
    if (this._libav !== null) {
      throw new Error("already inited");
    }
    const libavoptions =
      (options ?? {}).libavoptions ?? Video.DEFAULT_LIBAV_OPTIONS;

    // need to cast until PR #43 is merged into libavjs
    this._libav = await window.LibAV.LibAV(
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
    this._formatContext = fmt_ctx;
    this._videoStream = video_streams[0];
    this._videoDecoder = new VideoDecoder({
      output: (frame) => {
        console.log({ frame, dummy: this._nextIsDummyFrame });
        if (this._nextIsDummyFrame) {
          this._nextIsDummyFrame = false;
          assert(frame.timestamp === Video.FAKE_FIRST_FRAME_TIMESTAMP),
          frame.close();
        } else {
          assert(frame.timestamp !== Video.FAKE_FIRST_FRAME_TIMESTAMP),
          this._frameCache.push(frame);
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
    this._videoDecoder.configure(decoderConfig);
    await this.flushAndPrimeVideoDecoder();
  }

  async deinit() {
    await this.libav.unlink(this.input.name);
    this._videoDecoder.close();
    this.libav.terminate();
  }

  public async flushAndPrimeVideoDecoder() {
    if (!this._videoDecoder || this._videoDecoder.state !== "configured") {
      throw new Error("Run init() first (and no deinit())");
    }
    await this._videoDecoder.flush();
    this._frameCache = [];
    this._nextIsDummyFrame = true;
    const decoderConfig = (await LibAVWebcodecsBridge.videoStreamToConfig(
      this.libav,
      this.videoStream
    )) as VideoDecoderConfig;
    this._videoDecoder.decode(await createFakeKeyFrameChunk(decoderConfig));
  }

  async *getPackets(): AsyncGenerator<LibAVTypes.Packet, void, void> {
    const pkt = await this.libav.av_packet_alloc();
    let endOfStream = false;
    const streamIndex = this.videoStream.index;
    while (!endOfStream) {
      const [result, packets] = await this.libav.ff_read_multi(
        this.formatContext,
        pkt,
        undefined,
        { limit: 5 * 1024 * 1024 }
      );
      endOfStream = result === this.libav.AVERROR_EOF;
      for (const packet of packets[streamIndex]) {
        console.log([packet, packet.dts, packet.pts, packet.flags ]);
        yield packet;
        await new Promise(resolve => window.setTimeout(resolve, 1))
      }
    }
    await this.libav.av_packet_free(pkt);
    console.log("getPackets done");
  }

  async *getFrames(): AsyncGenerator<VideoFrame, void, void> {
    const packetGenerator = this.getPackets();
    let packetGeneratorDone = false;
    const stream = this.videoStream;
    while (true) {
      if (
        !packetGeneratorDone &&
        this._frameCache.length < Video.FRAME_CACHE_MAX_SIZE
      ) {
        if (
          this._videoDecoder.decodeQueueSize >
          Video.VIDEO_DEQUEUE_QUEUE_MAX_SIZE
        ) {
          await getPromiseFromEvent(this._videoDecoder, "dequeue");
          continue;
        }
        const { value: packet, done } = await packetGenerator.next();
        if (done) {
          packetGeneratorDone = true;
          await this._videoDecoder.flush();
          continue;
        }
        const chunk = LibAVWebcodecsBridge.packetToEncodedVideoChunk(
          packet,
          stream
        ) as EncodedVideoChunk;
        this._videoDecoder.decode(chunk);
      } else {
        if (this._frameCache.length === 0) {
          if (this._videoDecoder.decodeQueueSize > 0) {
            console.log("This should not happen I think.....");
            await getPromiseFromEvent(this._videoDecoder, "dequeue");
            continue;
          }
          if (packetGeneratorDone) {
            break;
          } else {
            throw new Error("How can this be empty?");
          }
        }
        const [frame] = this._frameCache.splice(0, 1);
        yield frame;
      }
    }
    console.log("getFrames done");
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

function promiseWithResolve<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  // next 6 lines could be made in one on platforms that support Promise.withResolvers()
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // @ts-expect-error used before assigned
  return { promise, resolve, reject };
}

/**
 * See https://github.com/Yahweasel/libavjs-webcodecs-bridge/issues/3#issuecomment-1837189047 for more info
 */
async function createFakeKeyFrameChunk(
  decoderConfig: VideoDecoderConfig
): Promise<EncodedVideoChunk> {
  const { promise, resolve, reject } = promiseWithResolve<EncodedVideoChunk>();
  const encoderConfig = { ...decoderConfig } as VideoEncoderConfig;
  // encoderConfig needs a width and height set; in my tests these dimensions
  // do not have to match the actual video dimensions, so I'm just using something
  // random for them
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
