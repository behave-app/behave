import type * as LibAVTypes from "../../public/app/bundled/libavjs/dist/libav.types";
import * as LibAVWebcodecsBridge from "libavjs-webcodecs-bridge"
declare global {
  interface Window {
    LibAV: LibAVTypes.LibAVWrapper;
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
    libav.unlink(input.name);
    libav.unlink(FFPROBEOUTPUT);
    const outputjson = new TextDecoder("utf-8").decode(writtenData);
    try {
      const videostreams = JSON.parse(outputjson).streams.filter(
        (s: any) => s.codec_type === "video"
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
  promise: Promise<T>,
  resolve: (value: T) => void,
  reject: (error: any) => void
} {
  // next 6 lines could be made in one on platforms that support Promise.withResolvers()
  let resolve: (value: T) => void
  let reject: (error: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  // @ts-ignore
  return {promise, resolve, reject}
}

/**
  * See https://github.com/Yahweasel/libavjs-webcodecs-bridge/issues/3#issuecomment-1837189047 for more info
  */
async function createFakeKeyFrameChunk(
  decoderConfig: VideoDecoderConfig
): Promise<EncodedVideoChunk> {
  const {promise, resolve, reject} = promiseWithResolve<EncodedVideoChunk>()
  const encoderConfig = {...decoderConfig} as VideoEncoderConfig
  // encoderConfig needs a width and height set; in my tests these dimensions
  // do not have to match the actual video dimensions, so I'm just using something
  // random for them
  encoderConfig.width = 640
  encoderConfig.height = 360
  encoderConfig.avc = {format: decoderConfig.description ? "avc" : "annexb"}
  const videoEncoder = new VideoEncoder({
    output: (chunk, _metadata) => resolve(chunk),
    error: e => reject(e)
    })
  try {
    videoEncoder.configure(encoderConfig)
    const oscanvas = new OffscreenCanvas(encoderConfig.width, encoderConfig.height)
    // getting context seems to be minimal needed before it can be used as VideoFrame source
    oscanvas.getContext("2d")
    const videoFrame = new VideoFrame(
      oscanvas, {timestamp: Number.MIN_SAFE_INTEGER})
    try {
      videoEncoder.encode(videoFrame)
      await videoEncoder.flush()
      const chunk =  await promise
      return chunk
    } finally {
      videoFrame.close()
    }
  } finally {
    videoEncoder.close()
  }
}

class VideoDecoderWrapper {
  private frames: VideoFrame[]
  private nextFrameNumber: number
  private nextIsDummyFrame: boolean
  private end_of_stream: boolean
  private videoDecoder: VideoDecoder

  private constructor(
    startFrameNumber: number,
    videoDecoderConfig: VideoDecoderConfig,
    private getMoreEncodedChunks: () => Promise<{chunks: EncodedVideoChunk[], end_of_stream: boolean}>,
  ) {
    this.frames = []
    this.end_of_stream = false
    this.nextIsDummyFrame = true
    this.nextFrameNumber = startFrameNumber
    this.videoDecoder = new VideoDecoder({
      output: this.addFrames.bind(this),
      error: error => console.log("Video decoder error", {error})
    })
    this.videoDecoder.configure(videoDecoderConfig)
  }

  public static async getVideoDecoderWrapper(
    startFrameNumber: number,
    videoDecoderConfig: VideoDecoderConfig,
    getMoreEncodedChunks: () => Promise<{chunks: EncodedVideoChunk[], end_of_stream: boolean}>,
): Promise<VideoDecoderWrapper> {
    const videoDecoderWrapper = new VideoDecoderWrapper(startFrameNumber, videoDecoderConfig, getMoreEncodedChunks)
    const chunk = await createFakeKeyFrameChunk(videoDecoderConfig)
    videoDecoderWrapper.videoDecoder.decode(chunk)
    return videoDecoderWrapper
  }


  public addFrames(videoFrame: VideoFrame) {
    this.frames.push(videoFrame)
  }

  public availableFrames(): number {
    return this.frames.length
  }

  public async getNextFrame(): Promise<VideoFrame | null> {
    while (this.availableFrames() || !this.end_of_stream) {
      if (this.frames.length) {
        let frame: VideoFrame = this.frames.splice(0, 1)[0]
        if (this.nextIsDummyFrame) {
          frame.close()
          this.nextIsDummyFrame = false
        } else {
          return frame
        }
      } else {
        const {chunks, end_of_stream} = await this.getMoreEncodedChunks()
        try {
        chunks.forEach(chunk => this.videoDecoder.decode(chunk))
        } catch (e) {
          console.log("my error", e)
          throw e
        }

        if (end_of_stream) {
          console.log("Closing")
          await this.videoDecoder.flush()
          this.videoDecoder.close()
          this.end_of_stream = true
        }
        // make sure there is time to run async code (probably not necessary but doesn't hurt)
        await new Promise(resolve => window.setTimeout(resolve, 0))
      }
    }
    return null
  }
}

/**
  * Gets video frames from a file.
  * Make sure to call frame.close() when done with a frame
  */
export async function* getFrames(
  input: File,
): AsyncGenerator<VideoFrame, void, void> {
  const libav = await window.LibAV.LibAV({ noworker: false, nothreads: true });
  await libav.av_log_set_level(libav.AV_LOG_ERROR);
  await libav.mkreadaheadfile(input.name, input);
  try {
    const [fmt_ctx, streams] = await libav.ff_init_demuxer_file(input.name);
    const video_streams: LibAVTypes.Stream[] = streams.filter(
      (s) => s.codec_type === libav.AVMEDIA_TYPE_VIDEO
    );
    if (video_streams.length !== 1) {
      throw new Error(
        `Problem with file ${input.name}, contains ${video_streams.length} video streams: ${video_streams}`
      );
    }
    const [stream] = video_streams;
    const pkt = await libav.av_packet_alloc()
    const decoderConfig = (await LibAVWebcodecsBridge.videoStreamToConfig(libav, stream)) as VideoDecoderConfig
    decoderConfig.hardwareAcceleration = "prefer-software"
    const videoDecoderWrapper = await VideoDecoderWrapper.getVideoDecoderWrapper(0, decoderConfig, async () => {
      const [result, packets] = await libav.ff_read_multi(
        fmt_ctx,
        pkt,
        undefined,
        { limit: 100 * 1024}
      );
      const end_of_stream = result === libav.AVERROR_EOF;
      const chunks = packets[stream.index].map(p => LibAVWebcodecsBridge.packetToEncodedVideoChunk(p, stream) as EncodedVideoChunk)
      return {chunks, end_of_stream}
    })

    while (true) {
      const frame = await videoDecoderWrapper.getNextFrame()
      if (frame === null) {
        console.log("done -- break")
        break;
      }
      yield frame;
    }
  } finally {
    await libav.unlink(input.name);
    libav.terminate();
  }
}
