import * as LibAVTypes from '../thirdparty/libav.js-4.5.6.0/dist/libav.types'

interface WindowWithLibAV {
  LibAV: LibAVTypes.LibAVWrapper
}

const LibAV = (window as unknown as WindowWithLibAV).LibAV
const libav = await LibAV.LibAV({noworker: true});

export async function readFile(file: File) {
  await libav.mkreadaheadfile("input", file)
  const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("input");

  console.log({fmt_ctx, streams})
  
  const [, c, pkt, frame] = await libav.ff_init_decoder(streams[0].codec_id, streams[0].codecpar);
  console.log({c, pkt, frame})
  let packetcnt = 0

  // const outputfile = await (window as any).showSaveFilePicker({suggestedName: "output.mp4"})
  // const outputstream = await outputfile.createWritable()

  await libav.mkwriterdev("output.mov");
  const [oc, fmt, pb] = await libav.ff_init_muxer({filename: "output.mov", open: true, codecpars: true}, [[streams[0].codecpar, streams[0].time_base_num, streams[0].time_base_den]])
  console.log({oc, fmt, pb})
  await libav.avformat_write_header(oc, 0)

  libav.onwrite = function(name, pos, data) {
    console.log(`Writing ${data.length} bytes at ${pos} for ${name}`)
    // outputstream.seek(pos)
    // outputstream.write(data)
};

  while (true) {
    const [result,  packets] = await libav.ff_read_multi(fmt_ctx, pkt, "input", {limit: 1024*1024, unify: false})
    if (result === libav.AVERROR_EOF) {
      console.log("EOF")
      break;
    }
    console.log({result, packets})
    packetcnt += packets[0].length
    const pkt2 = await libav.av_packet_alloc()
    await libav.ff_write_multi(oc, pkt, packets[0] || [])
  }
  libav.av_write_trailer(oc)
  console.log(`done, found ${packetcnt} packets`)
  await libav.unlink("input")
  await libav.unlink("output")
  await libav.ff_free_muxer(oc, pb)
  // outputstream.close()

}

export async function do_ffmpeg(file: File) {
  await libav.mkreadaheadfile("input", file)
  await libav.mkwriterdev("output");
  const outputfile = await (window as any).showSaveFilePicker({suggestedName: "output.mp4"})
  const outputstream = await outputfile.createWritable()

  libav.onwrite = function(name, pos, data) {
    console.log(`Writing ${data.length} bytes at ${pos} for ${name}`)
    outputstream.seek(pos)
    outputstream.write(data)
};

  // NOTE: not sure if libav.ffmpeg is working, seems to be doing nothing....
  const exit_code = await libav.ffmpeg(
    "-i", "input",
    "-f", "mp4",
    "-y", "output"
);
  console.log({exit_code})

  await libav.unlink("input")
  await libav.unlink("output")
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
    readFile(file)
    // do_ffmpeg(file)
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
