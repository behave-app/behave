import type * as LibAVTypes from '../thirdparty/libav.js/dist/libav.types'
import {tf, setWasmPaths} from '../bundled/tfjs.js'
import { stream } from 'undici-types'

declare global {
  interface Window {
    LibAV: LibAVTypes.LibAVWrapper
  }
}

setWasmPaths("public/bundled/tfjs-wasm/")
await tf.setBackend("wasm")
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
  const start = Date.now()
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
    //console.log("muxing", packet, {pos, size}, DUMP && [...packet.data].map(i => (i + 0x100).toString(16).slice(1)).join(" ").replace(/((?:.. ){8})((?:.. ){8})/g, "$1 $2\n") )
    if ((++packetnr) % 2500 == 0) {
      // console.log(`Did packet ${packetnr} (${packetnr / 25} seconds)`)
        const time = Date.now() - start
        console.log(`Framenr ${packetnr} in ${time}ms; ${(packetnr / time * 1000).toFixed(1)}fps`);
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

export async function do_ai(file: File) {
  const ctx2d = (document.getElementById("canvas") as HTMLCanvasElement).getContext("2d")!
  const filename = file.name
  await libav.mkreadaheadfile(filename, file)
  // const modelDirectory = await window.showDirectoryPicker({id: "model"})
  // const model = await getModel(modelDirectory)
  // console.log(model)
  let scale_ctx: null | number = null
  const soutFrame = await libav.av_frame_alloc();
  let ret;

  const ifmt_ctx = await libav.avformat_open_input_js(filename, 0, 0);
  if (!ifmt_ctx) {
    throw new Error(
      "Could not open input file " + filename);
  }

  if ((ret = await libav.avformat_find_stream_info(ifmt_ctx, 0)) < 0) {
    throw new Error(
      "Failed to retrieve input stream information");
  }


  await libav.avformat_find_stream_info(ifmt_ctx, 0);
  const nb_streams = await libav.AVFormatContext_nb_streams(ifmt_ctx);

  let video_stream: LibAVTypes.Stream | null = null
  for (var i = 0; i < nb_streams; i++) {
    const inStream = await libav.AVFormatContext_streams_a(ifmt_ctx, i);
    const codecpar = await libav.AVStream_codecpar(inStream);
    const codec_type = await libav.AVCodecParameters_codec_type(codecpar);
    if (codec_type !== libav.AVMEDIA_TYPE_VIDEO) {
      continue
    }
    video_stream = {
      ptr: inStream,
      index: i,
      codecpar,
      codec_type,
      codec_id: await libav.AVCodecParameters_codec_id(codecpar),
      time_base_num: await libav.AVStream_time_base_num(inStream),
      time_base_den: await libav.AVStream_time_base_den(inStream),
      duration_time_base: await libav.AVStream_duration(inStream) + (await libav.AVStream_durationhi(inStream)*0x100000000),
      duration: 0,
    };

    video_stream.duration = video_stream.duration_time_base * video_stream.time_base_num / video_stream.time_base_den;
    break;
  }
  if (!video_stream) {
    throw new Error("Could not find video stream")
  }
  const [codec, c, pkt, frameptr] = await libav.ff_init_decoder(
    video_stream.codec_id, video_stream.codecpar)

  const start = Date.now()
  let framenr = 0
  packetloop: while (true) {
    ret = await libav.av_read_frame(ifmt_ctx, pkt);
    if (ret < 0)
    break;

    let pkt_stream_index = await
      libav.AVPacket_stream_index(pkt);
    if (pkt_stream_index !== video_stream.index) {
      await libav.av_packet_unref(pkt);
      continue
    }
    // console.log({size: await libav.AVPacket_size(pkt)})
    ret = await libav.avcodec_send_packet(c, pkt)
    if (ret < 0) {
      throw new Error("Error submitting the packet to the decoder: " + await libav.ff_error(ret))
    }
    await libav.av_packet_unref(pkt)
    while (true) {
      ret = await libav.avcodec_receive_frame(c, frameptr);
      if (ret === libav.EAGAIN) {
        // console.log("again")
        break
      } else if (ret === libav.AVERROR_EOF) {
        // console.log("EOF")
        break packetloop
      } else if (ret < 0) {
        // console.log("Error decoding video frame: " + await libav.ff_error(ret));
        break
      }
      // var outFrame = await libav.ff_copyout_frame(frame);
      // if (scale_ctx === null) {
      //   const frame = await libav.ff_copyout_frame(frameptr)
      //   scale_ctx = await libav.sws_getContext(frame.width!, frame.height!, frame.format, 640, 360, libav.AV_PIX_FMT_RGBA, 2, 0, 0, 0)
      // }
      // await libav.sws_scale_frame(scale_ctx, soutFrame, frameptr);
      await libav.av_frame_unref(frameptr)
      // const frame = await libav.ff_copyout_frame(soutFrame);
      //
      //
      //   const id = ctx2d.createImageData(640, 360);
      // {
      //     let idx = 0;
      //     const plane = frame.data[0];
      //     for (const line of plane) {
      //       id.data.set(line, idx);
      //       idx += 640 * 4;
      //     }
      //   }
      //   const ib = await createImageBitmap(id);
      //   ctx2d.drawImage(ib, 0, 0, 640, 360);
      // await libav.av_frame_unref(soutFrame)
      // console.log(frame)
      // await new Promise(resolve => window.setTimeout(resolve, 200))
      framenr++
      if (framenr % 100 == 0) {
        const time = Date.now() - start
        console.log(`Framenr ${framenr} in ${time}ms; ${(framenr / time * 1000).toFixed(1)}fps`);
      }
    }
  }
  console.log("done", {framenr})
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
    do_ai(file)
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
