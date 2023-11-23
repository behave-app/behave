import type * as LibAVTypes from '../public/bundled/libavjs/dist/libav.types'

declare global {
  interface Window {
    LibAV: LibAVTypes.LibAVWrapper
  }
}

const libav = await window.LibAV.LibAV({yesthreads: true});

class WritableFile {
  constructor(
    public readonly name: string,
    public readonly stream: FileSystemWritableFileStream,
  ) {}
}

class ReadableFile {
  constructor(
    public readonly name: string,
    public readonly file: File,
  ) {}
}

async function do_ffmpeg(parameters: (string | ReadableFile | WritableFile)[]) {
  let fileMap: Map<string, WritableFile | ReadableFile> = new Map()
  for (let parameter of parameters) {
    if (parameter instanceof WritableFile || parameter instanceof ReadableFile) {
      if (fileMap.has(parameter.name)) {
        throw new Error(`Already has name: ${parameter.name}`)
      }
      fileMap.set(parameter.name, parameter)
    }
    if (parameter instanceof WritableFile) {
      await libav.mkwriterdev(parameter.name)
    }
    if (parameter instanceof ReadableFile) {
      await libav.mkreadaheadfile(parameter.name, parameter.file)
    }
  }

  let writePromises: Set<Promise<any>> = new Set()
  libav.onwrite = function(name, pos, data) {
    const mapped = fileMap.get(name)
    if (!mapped) {
      throw new Error(`No stream with name ${name}`)
    }
    if ("file" in mapped) {
      throw new Error(`File ${name} is an input file`)
    }
    const promise = mapped.stream.write({type: "write", data: data.slice(0), position: pos})
    writePromises.add(promise)
    promise.then(() => {writePromises.delete(promise)})
  }

  // NOTE: not sure if libav.ffmpeg is working, seems to be doing nothing....
  const exit_code = await libav.ffmpeg(
    parameters.map(p => typeof p === "string" ? p : p.name)
  );
  console.log({exit_code})

  await Promise.all([...fileMap].map(([_, p]) => libav.unlink(p.name)))
  console.log(`${writePromises.size} promises to wait for`)
  await Promise.all([...writePromises])
}

async function convert_to_mp4(files: File[]) {
  const outputDirectory = await window.showDirectoryPicker({id: "convertoutput", mode: "readwrite"})
  for (let file of files) {
    try {
      await outputDirectory.getFileHandle(file.name + ".mp4")
      alert(`There is already a file in the output directory with name ${file.name}`)
      return
    } catch (e) {
      if ((e as DOMException).name !== "NotFoundError") {
        alert(`There is an error with  the file in the output directory with name ${file.name}`)
        console.log(e)
      return
      }
    }
  }
  for (let file of files) {
    console.log(`Processing ${file.name}`)
    const outputFile = await outputDirectory.getFileHandle(file.name + ".mp4", {create: true})
    const outputStream = await outputFile.createWritable()
    const start = Date.now()
    await do_ffmpeg([
      "-i", new ReadableFile(file.name, file),
      "-nostdin",
      "-c:v", "copy",
      "-an",
      "-y", new WritableFile(file.name + ".mp4", outputStream)
    ])
    outputStream.close()
    const duration = Date.now() - start
    console.log(`Converting ${file.name} took ${(duration / 1000).toFixed(2)} seconds (${(file.size / 1024 / 1024 / (duration / 1000)).toFixed(1)}MB/s)`)
  }
  alert("done")
}

function addDropListeners() {
  const dropzone = document.getElementById("dropzone")!
  const original_html = dropzone.innerHTML
  dropzone.addEventListener("drop", event => {
    event.preventDefault();
    const files = [...event.dataTransfer!.items].map(i => i.getAsFile()!)
    console.log(`found files`, files)
    convert_to_mp4(files)
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
