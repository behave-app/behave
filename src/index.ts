import type * as LibAVTypes from '../thirdparty/libav.js/dist/libav.types'
//@ts-ignore
import {LibAVWebCodecsBridge} from '../bundled/libavjs-webcodecs-bridge.js'
//@ts-ignore
import {tf, setWasmPaths} from '../bundled/tfjs.js'

declare global {
  interface Window {
    LibAV: LibAVTypes.LibAVWrapper
  }
}

const COLOURS = {
  "none": 'hsl(0, 0%, 70%)',
  0: 'hsl(0, 50%, 70%)',
  1: 'hsl(120, 50%, 70%)',
  2: 'hsl(240, 50%, 70%)',
  3: 'hsl(0, 100%, 70%)',
  4: 'hsl(120, 100%, 70%)',
} as const
setWasmPaths("public/bundled/tfjs-wasm/")
await tf.setBackend("webgpu")
await tf.ready()
console.log(tf.backend())
const DUMP=false

const libav = await window.LibAV.LibAV({noworker: true});

console.log({mode: libav.libavjsMode})

export async function readFile(file: File) {
  await libav.mkreadaheadfile("input", file)
  const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("input");

  console.log({fmt_ctx, streams})

  const [, c, pkt, frame] = await libav.ff_init_decoder(streams[0].codec_id, streams[0].codecpar);
  while (true) {
    const [result,  packets] = await libav.ff_read_multi(fmt_ctx, pkt, "input", {limit: 1024*1024, unify: false})
    if (result === libav.AVERROR_EOF) {
      console.log("EOF")
      break;
    }
    console.log({result, packets})
  }
  await libav.unlink("input")
}


console.log("bla")


export async function remuxFile(file: File) {
  await libav.mkreadaheadfile("input", file)
  await libav.mkwriterdev("output.mp4")
  console.log("bla")


  const outputstream = await (await window.showSaveFilePicker({suggestedName: file.name.replace(/\.[^.]*$/, ".mp4")})).createWritable()
  let writePromises: Promise<any>[] = []
  libav.onwrite = function(name, pos, data) {
    // console.log(`Write to ${name} at pos ${pos}, ${data.length} bytes:\n${DUMP && [...new Uint8Array(data)].map(i => i.toString(16).replace(/^(.)$/, "0$1")).join(" ").replace(/((?:.. ){8})((?:.. ){8})/g, "$1 $2\n")}` )
    writePromises.push(outputstream.write({type: "write", data: data.slice(0), position: pos}))
  }
  const in_filename = "input"
  const out_filename = "output.mp4"
  let ret: number;

  const pkt = await libav.av_packet_alloc();
  if (!pkt) {
    throw new Error(
      "Could not allocate AVPacket");
  }

  const ifmt_ctx = await libav.avformat_open_input_js(in_filename, 0, 0);
  if (!ifmt_ctx) {
    throw new Error(
      "Could not open input file " + in_filename);
  }

  if ((ret = await libav.avformat_find_stream_info(ifmt_ctx, 0)) < 0) {
    throw new Error(
      "Failed to retrieve input stream information");
  }

  //av_dump_format(ifmt_ctx, 0, in_filename, 0);

  const ofmt_ctx = await
    libav.avformat_alloc_output_context2_js(
      0, "mp4", out_filename);
  if (!ofmt_ctx) {
    throw new Error(
      "Could not create output context");
  }

  const stream_mapping_size = await libav.AVFormatContext_nb_streams(ifmt_ctx);
  const stream_mapping = [];

  const ofmt = await libav.AVFormatContext_oformat(ofmt_ctx);

  let stream_index = 0;
  for (let i = 0; i < stream_mapping_size; i++) {
    const in_stream = await libav.AVFormatContext_streams_a(ifmt_ctx, i);
    const in_codecpar = await libav.AVStream_codecpar(in_stream);
    const codec_type = await libav.AVCodecParameters_codec_type(in_codecpar);

    if (codec_type != libav.AVMEDIA_TYPE_VIDEO || stream_mapping.indexOf(0) !== -1) {
      stream_mapping.push(-1);
      continue;
    }
    stream_mapping.push(0);

    const out_stream = await libav.avformat_new_stream(ofmt_ctx, 0);
    if (!out_stream) {
      throw new Error("Failed allocating output stream");
    }

    const out_codecpar = await libav.AVStream_codecpar(out_stream);
    ret = await libav.avcodec_parameters_copy(out_codecpar, in_codecpar);
    if (ret < 0) {
      throw new Error(
        "Failed to copy codec parameters");
    }
    await libav.AVCodecParameters_codec_tag_s(out_codecpar, 0);
  }

  //av_dump_format(ofmt_ctx, 0, out_filename, 1);
  //libav

  const opb = await
    libav.avio_open2_js(out_filename, libav.AVIO_FLAG_WRITE, 0, 0);
  if (!opb) {
    throw new Error(
      "Could not open output file " + out_filename);
  }
  await libav.AVFormatContext_pb_s(ofmt_ctx, opb);

  ret = await libav.avformat_write_header(ofmt_ctx, 0);
  if (ret < 0) {
    throw new Error(
      "Error occurred when opening output file");
  }

  let packetnr = 0;
  let ts_offset = 0;
  while (true) {
    ret = await libav.av_read_frame(ifmt_ctx, pkt);
    if (ret < 0)
    break;

    let pkt_stream_index = await
      libav.AVPacket_stream_index(pkt);
    const in_stream = await
      libav.AVFormatContext_streams_a(ifmt_ctx, pkt_stream_index);
    if (pkt_stream_index >= stream_mapping_size ||
      // dump packets we don't want
      stream_mapping[pkt_stream_index] < 0) {
      // console.log("Dumping unwanted packet", pkt)
      await libav.av_packet_unref(pkt);
      continue;
    }

    pkt_stream_index = stream_mapping[pkt_stream_index];
    await libav.AVPacket_stream_index_s(pkt, pkt_stream_index);
    const out_stream = await
      libav.AVFormatContext_streams_a(ofmt_ctx, pkt_stream_index);
    //log_packet(ifmt_ctx, pkt, "in");

    const pos = await libav.AVPacket_pos(pkt)
    const size = await libav.AVPacket_size(pkt)
    if (packetnr === 0) {
      ts_offset = -1 * await libav.AVPacket_pts(pkt)
    }
    const new_pts = await libav.AVPacket_pts(pkt) + ts_offset
    const new_dts = await libav.AVPacket_dts(pkt) + ts_offset
    await libav.AVPacket_pts_s(pkt, new_pts);
    await libav.AVPacket_ptshi_s(pkt, new_pts < 0 ? -1 : 0);
    await libav.AVPacket_dts_s(pkt, new_dts);
    await libav.AVPacket_dtshi_s(pkt, new_dts < 0 ? -1 : 0);
    const packet = await libav.ff_copyout_packet(pkt)
    if (packet.dtshi === -0x80000000) {
      console.log("dropping", packet, {pos, size}, DUMP && [...packet.data].map(i => (i + 0x100).toString(16).slice(1)).join(" ").replace(/((?:.. ){8})((?:.. ){8})/g, "$1 $2\n") )
      // libav.av_packet_free(pkt);
      continue;
    }
    console.log("muxing", packet, {pos, size}, DUMP && [...packet.data].map(i => (i + 0x100).toString(16).slice(1)).join(" ").replace(/((?:.. ){8})((?:.. ){8})/g, "$1 $2\n") )
    if ((++packetnr) % 2500 == 0) {
      console.log(`Did packet ${packetnr} (${packetnr / 25} seconds)`)
    }

    /* copy packet */
    const [in_tb_num, in_tb_den, out_tb_num, out_tb_den] = [
      await libav.AVStream_time_base_num(in_stream),
      await libav.AVStream_time_base_den(in_stream),
      await libav.AVStream_time_base_num(out_stream),
      await libav.AVStream_time_base_den(out_stream)
    ];
    await libav.av_packet_rescale_ts_js(
      pkt, in_tb_num, in_tb_den, out_tb_num, out_tb_den);
    await libav.AVPacket_pos_s(pkt, -1);
    await libav.AVPacket_poshi_s(pkt, -1);
    //log_packet(ofmt_ctx, pkt, "out");

    ret = await libav.av_interleaved_write_frame(ofmt_ctx, pkt);
    /* pkt is now blank (av_interleaved_write_frame() takes ownership of
         * its contents and resets pkt), so that no unreferencing is necessary.
         * This would be different if one used av_write_frame(). */
    if (ret < 0) {
      throw new Error(
        "Error muxing packet");
    }
  }

  await libav.av_write_trailer(ofmt_ctx);
  await libav.av_packet_free_js(pkt);

  await libav.avformat_close_input_js(ifmt_ctx);

  /* close output */
  await libav.avio_close(opb);
  await libav.avformat_free_context(ofmt_ctx);

  console.log(`${writePromises.length} promises to wait for`)
  await Promise.all(writePromises)
  await outputstream.close()
}

export async function do_ffmpeg(file: File) {
  await libav.mkreadaheadfile("input", file)
  await libav.mkwriterdev("output");
  const outputfile = await window.showSaveFilePicker({suggestedName: "output.mp4"})
  const outputstream = await outputfile.createWritable()

  let writePromises: Promise<any>[] = []
  libav.onwrite = function(name, pos, data) {
    writePromises.push(outputstream.write({type: "write", data: data.slice(0), position: pos}))
  }

  // NOTE: not sure if libav.ffmpeg is working, seems to be doing nothing....
  const exit_code = await libav.ffmpeg(
    "-nostdin",
    "-i", "input",
    "-an",
    "-c:v", "copy",
    "-f", "mp4",
    "-y", "output"
  );
  console.log({exit_code})

  await libav.unlink("input")
  await libav.unlink("output")
  console.log(`${writePromises.length} promises to wait for`)
  await Promise.all(writePromises)
  await outputstream.close()
}

interface ModelData {
  weightsManifest: {paths: string[]}[]
}

type Model = any; // TODO

async function getModel(modelDirectory: FileSystemDirectoryHandle): Promise<Model> {
  const modelFile = await modelDirectory.getFileHandle("model.json").then(fh => fh.getFile())
  const modelData = JSON.parse(await modelFile.text()) as ModelData
  const weightFiles = await Promise.all(modelData.weightsManifest[0].paths.map(
    name => modelDirectory.getFileHandle(name).then(fh => fh.getFile())))
  const model = await tf.loadGraphModel(tf.io.browserFiles([modelFile, ...weightFiles]))
  return model
}

const pixelCanvas = document.createElement("canvas")
pixelCanvas.width = 640
pixelCanvas.height = 640
const pixelCanvasCtx = pixelCanvas.getContext("2d")!
if (!pixelCanvasCtx) {
  throw new Error("Cannot get pixelCanvas Context")
}

function preprocess(frame: VideoFrame, modelWidth: number, modelHeight: number): [tf.Tensor<tf.Rank>, number, number] {
  let xRatio, yRatio; // ratios for boxes

  pixelCanvasCtx.drawImage(frame, 0, (640-360) / 2, 640, 360)
  const input = tf.tidy(() => {
    const img = tf.browser.fromPixels(pixelCanvas);

    return img
      .div(255.0) // normalize
      .expandDims(0); // add batch
  });

  return [input, 1, 1];
};

async function createFakeKeyFrameChunk(
  decoderConfig: VideoDecoderConfig
): Promise<EncodedVideoChunk> {
  // next 6 lines could be made in one on platforms that support Promise.withResolvers()
  let resolve: (value: EncodedVideoChunk) => void
  let reject: (error: any) => void
  const promise = new Promise<EncodedVideoChunk>((res, rej) => {
    resolve = res
    reject = rej
  })
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
      console.log("done promise")
      return chunk
    } finally {
      videoFrame.close()
    }
  } finally {
    videoEncoder.close()
  }
}

export async function play_webcodecs(file: File) {
  const ctx2d = (document.getElementById("canvas") as HTMLCanvasElement).getContext("2d")!
  const filename = file.name
  await libav.mkreadaheadfile(filename, file)

  const [fmt_ctx, streams] = await libav.ff_init_demuxer_file(filename)
  const stream_types = await Promise.all(streams.map(s => libav.AVCodecParameters_codec_type(s.codecpar)))
  const video_streams = streams.filter((_, i) => stream_types[i] == libav.AVMEDIA_TYPE_VIDEO)
  if (video_streams.length !== 1) {
    throw new Error(`File with exactly one video stream needed; given file ${filename} has ${video_streams.length} video streams`)
  }
  let video_stream = video_streams[0]
  console.log(video_stream)
  const [, ctx, pkt, frame] = await libav.ff_init_decoder(video_stream.codec_id, video_stream.codecpar);
  const start = Date.now()

  let framenr = 0
  function newFrame(frame: VideoFrame) {
    try {
      framenr++
      if (framenr === 1) {
        // skip the first frame
        return;
      }
      if (framenr % 100 == 0) {
        const time = Date.now() - start
        console.log(`Framenr ${framenr} in ${time}ms; ${(framenr / time * 1000).toFixed(1)}fps (${(time / framenr).toFixed(1)}ms per frame)`);
      }
      ctx2d.drawImage(frame, 0, 0, 640, 360)
    } finally {
      frame.close()
    }
  }

  const decoderConfig = await LibAVWebCodecsBridge.videoStreamToConfig(libav, video_stream) as VideoDecoderConfig
  decoderConfig.hardwareAcceleration = "prefer-software"
  console.log({decoderConfig})
  const videoDecoder = new VideoDecoder({output: newFrame, error: error => console.log({error})})
  videoDecoder.configure(decoderConfig)


  videoDecoder.decode(await createFakeKeyFrameChunk(decoderConfig))

  while (true) {
    const [ret, packets] = await libav.ff_read_multi(fmt_ctx, pkt, undefined, {limit: 1024 * 1024})
    if (ret !== libav.AVERROR_EOF && ret !== -libav.EAGAIN && ret !== 0)
    throw new Error("Invalid return from ff_read_multi");
    const video_packets = packets[video_stream.index]
    if (!video_packets) {
      continue
    }
    const is_last_bytes = ret === libav.AVERROR_EOF
    for (const packet of packets[video_stream.index]) {
      const encodedVideoChunk = LibAVWebCodecsBridge.packetToEncodedVideoChunk(packet, video_stream) as EncodedVideoChunk
      videoDecoder.decode(encodedVideoChunk)
    }
    if (is_last_bytes) {
      videoDecoder.flush()
      console.log("done")
      break
    }
  }
}

export async function do_ai(file: File) {
  const ctx2d = (document.getElementById("canvas") as HTMLCanvasElement).getContext("2d")!
  const filename = file.name
  await libav.mkreadaheadfile(filename, file)
  const modelDirectory = await window.showDirectoryPicker({id: "model"})
  const model = await getModel(modelDirectory)
  console.log(model)

  let scale_ctx: null | number = null
  const soutFrame = await libav.av_frame_alloc();

  const [fmt_ctx, streams] = await libav.ff_init_demuxer_file(filename)
  const stream_types = await Promise.all(streams.map(s => libav.AVCodecParameters_codec_type(s.codecpar)))
  const video_streams = streams.filter((_, i) => stream_types[i] == libav.AVMEDIA_TYPE_VIDEO)
  if (video_streams.length !== 1) {
    throw new Error(`File with exactly one video stream needed; given file ${filename} has ${video_streams.length} video streams`)
  }
  let video_stream = video_streams[0]
  console.log(video_stream)
  const [, ctx, pkt, frame] = await libav.ff_init_decoder(video_stream.codec_id, video_stream.codecpar);
  const start = Date.now()
  const config = await LibAVWebCodecsBridge.videoStreamToConfig(libav, video_stream) as VideoDecoderConfig
  config.hardwareAcceleration = "prefer-software"
  config.description = undefined
  console.log({config})

  function newFrame(frame: VideoFrame) {
    //console.log({frame})
    const [img_tensor, xRatio, yRatio] = preprocess(frame, 640, 640);
    let intimerstart = Date.now()
    const res = model.execute(img_tensor);
    let transRes = res.transpose([0, 2, 1]); // transpose result [b, det, n] => [b, n, det]
    const boxes = tf.tidy(() => {
      const w = transRes.slice([0, 0, 2], [-1, -1, 1]); // get width
      const h = transRes.slice([0, 0, 3], [-1, -1, 1]); // get height
      const x1 = tf.sub(
        transRes.slice([0, 0, 0], [-1, -1, 1]),
        tf.div(w, 2)
      ); // x1
      const y1 = tf.sub(
        transRes.slice([0, 0, 1], [-1, -1, 1]),
        tf.div(h, 2)
      ); // y1
      return tf
        .concat(
          [
            y1,
            x1,
            tf.add(y1, h), //y2
            tf.add(x1, w), //x2
          ],
          2
        )
        .squeeze();
    }); // process boxes [y1, x1, y2, x2]

    const [scores, classes] = tf.tidy(() => {
      // class scores
      const rawScores = transRes.slice([0, 0, 4], [-1, -1, 5]).squeeze(0); // #6 only squeeze axis 0 to handle only 1 class models
      return [rawScores.max(1), rawScores.argMax(1)];
    }); // get max scores and classes index

    const nms = tf.image.nonMaxSuppression(
      boxes as tf.Tensor2D,
      scores,
      500,
      0.45,
      0.5
    ); // NMS to filter boxes

    const boxes_data = boxes.gather(nms, 0).dataSync(); // indexing boxes by nms index
    const scores_data = scores.gather(nms, 0).dataSync(); // indexing scores by nms index
    const classes_data = classes.gather(nms, 0).dataSync(); // indexing classes by nms index
    tf.dispose([res, transRes, boxes, scores, classes, nms]);
    framenr++
    if (framenr % 100 == 0) {
      const time = Date.now() - start
      console.log(`Framenr ${framenr} in ${time}ms; ${(framenr / time * 1000).toFixed(1)}fps`);
    }
    ctx2d.drawImage(frame, 0, 0, 640, 360)
    for (let i=0; i < classes_data.length; ++i) {
      ctx2d.strokeStyle=COLOURS[classes_data[i] as (0|1|2|3|4)] || COLOURS["none"];
      const score = (scores_data[i] * 100).toFixed(1);

      let [y1, x1, y2, x2] = boxes_data.slice(i * 4, (i + 1) * 4);
      y1 -= (640-360) / 2
      y2 -= (640-360) / 2
      const width = x2 - x1;
      const height = y2 - y1;
      ctx2d.strokeRect(x1, y1, width, height);
    }
    frame.close()
    tf.dispose([boxes_data, scores_data, classes_data, img_tensor])
  }

  const videoDecoder = new VideoDecoder({output: newFrame, error: error => console.log({error})})
  console.log("preconfig")
  videoDecoder.configure(config)
  console.log("postconfig")
  let framenr = 0
  while (true) {
    const [ret, packets] = await libav.ff_read_multi(fmt_ctx, pkt, undefined, {limit: 1024 * 1024})
    if (ret !== libav.AVERROR_EOF && ret !== -libav.EAGAIN && ret !== 0)
    throw new Error("Invalid return from ff_read_multi");
    const video_packets = packets[video_stream.index]
    if (!video_packets) {
      continue
    }
    const is_last_bytes = ret === libav.AVERROR_EOF
    for (const packet of packets[video_stream.index]) {
      const encodedVideoChunk = LibAVWebCodecsBridge.packetToEncodedVideoChunk(packet, video_stream) as EncodedVideoChunk
      videoDecoder.decode(encodedVideoChunk)
    }
    if (is_last_bytes) {
      videoDecoder.flush()
      console.log("done")
      break
    }
  }
}


function addDropListeners() {
  const dropzone = document.getElementById("dropzone")!
  const original_html = dropzone.innerHTML
  dropzone.addEventListener("drop", event => {
    event.preventDefault();
    if ((event.dataTransfer!.items || []).length !== 1
      || event.dataTransfer!.items[0].kind !== "file" ) {
      throw new Error("Drop a single file!!!")
    }
    const file = event.dataTransfer!.items[0].getAsFile()!
    console.log(`found file ${file.name} (${file.size})`)
    // readFile(file)
    // remuxFile(file)
    // do_ffmpeg(file)
    play_webcodecs(file)
  })
  dropzone.addEventListener("dragover", event => {
    event.preventDefault();
  })
  dropzone.addEventListener("dragenter", () => {
    dropzone.innerText = "Drop file here"
  })
  dropzone.addEventListener("dragleave", () => {
    dropzone.innerHTML = original_html
  })
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", addDropListeners)
} else {
  addDropListeners();
}
