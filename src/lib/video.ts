import type * as LibAVTypes from '../../public/app/bundled/libavjs/dist/libav.types'
declare global {
  interface Window {
    LibAV: LibAVTypes.LibAVWrapper
  }
}

export async function getNumberOfFrames(input: File): Promise<number> {
  const FFPROBEOUTPUT = "__ffprobe_output__"
  const libav = await window.LibAV.LibAV({noworker: false, nothreads: true});
  try {
    await libav.mkreadaheadfile(input.name, input)
    await libav.mkwriterdev(FFPROBEOUTPUT)
    let writtenData = new Uint8Array(0);
    libav.onwrite = function(_name, pos, data) {
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
      "-loglevel", "error",
      "-of", "json",
      "-o", FFPROBEOUTPUT,
      input.name
    )
    if (exit_code != 0) {
      throw new Error(`ffprobe exit code: ${exit_code}`)
    }
    libav.unlink(input.name)
    libav.unlink(FFPROBEOUTPUT)
    // should we destroy libavjs? // TODO
    const outputjson = new TextDecoder("utf-8").decode(writtenData)
    try {
      const videostreams = JSON.parse(outputjson).streams.filter((s: any) => s.codec_type === "video")
      if (videostreams.length !== 1) {
        throw new Error("Too many videostreams")
      }
      const duration = parseFloat(videostreams[0].duration)
      const avg_frame_rate = videostreams[0].avg_frame_rate.split("/")
      const nrframes = Math.round(
        duration / parseInt(avg_frame_rate[1] ?? "1") * parseInt(avg_frame_rate[0]))
      if (!Number.isInteger(nrframes)) {
        throw new Error(`Unexpected number of frames: ${nrframes}`)
      }
      return nrframes
    } catch (e) {
      throw new Error(`Problem parsing number of packets: ${JSON.stringify(outputjson)}; ${e}}`)
    }
  } finally {
    libav.terminate()
  }
}

export async function* getFrames(
  input: File,
  width: number,
  height: number,
): AsyncGenerator<ImageData, void, void> {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error("Not ints")
  }
  let scale_ctx: null | number = null
  const libav = await window.LibAV.LibAV({noworker: false, nothreads: true});
  await libav.av_log_set_level(libav.AV_LOG_ERROR)
  await libav.mkreadaheadfile(input.name, input)
  try {
    const [fmt_ctx, streams] = await libav.ff_init_demuxer_file(input.name);
    const video_streams: LibAVTypes.Stream[] = streams.filter(
      s => s.codec_type === libav.AVMEDIA_TYPE_VIDEO)
    if (video_streams.length !== 1) {
      throw new Error(`Problem with file ${input.name}, contains ${video_streams.length} video streams: ${video_streams}`)
    }
    const [stream] = video_streams
    const [, c, pkt, frameptr] = await libav.ff_init_decoder(stream.codec_id, stream.codecpar);
    while (true) {
      const [result, packets] = await libav.ff_read_multi(fmt_ctx, pkt, undefined, {limit: 100 * 1024});
      const end_of_stream = result === libav.AVERROR_EOF
      const framePointers = await libav.ff_decode_multi(
        c,
        pkt,
        frameptr,
        packets[stream.index],
        {fin: end_of_stream, copyoutFrame: "ptr"}) as unknown as number[]

      for (const fp of framePointers) {
        if (scale_ctx === null) {
          const frameWidth = await libav.AVFrame_width(fp)
          const frameHeight = await libav.AVFrame_height(fp)
          const frameFormat = await libav.AVFrame_format(fp)
          const scaleFactor = Math.min(
            1, 
            width / frameWidth,
            height / frameHeight)
          const targetWidth = Math.round(frameWidth * scaleFactor)
          const targetHeight = Math.round(frameHeight * scaleFactor)

          scale_ctx = await libav.sws_getContext(
            frameWidth,
            frameHeight,
            frameFormat,
            targetWidth,
            targetHeight,
            libav.AV_PIX_FMT_RGBA, 2, 0, 0, 0)
        }
        await libav.sws_scale_frame(scale_ctx, frameptr, fp);
        const imageData = await libav.ff_copyout_frame_video_imagedata(frameptr)
        await libav.av_frame_unref(fp)
        await libav.av_frame_unref(frameptr)
        yield imageData
      }
      if (end_of_stream) {
        break
      }
    }
  } finally {
    await libav.unlink(input.name)
    libav.terminate()
  }
}
