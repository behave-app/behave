import {Upload} from "../lib/Upload.js"
import {FileTree, FileTreeBranch, readFileSystemHandle, updateLeaf, convertAll} from "../lib/FileTree.js"
import * as css from "./inferrer.module.css"
import { JSX } from "preact"
import {useState, useEffect} from 'preact/hooks'
import {setBackend, Model, getModel, convert, getOutputFilename} from "./tfjs.js"

const NR_WORKERS = 4

function fileFilter(file: File, extension: string): boolean {
  return !file.name.startsWith(".") && file.name.endsWith("." + extension)
}


export function Inferrer({}: {}): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [state, setState] = useState<"uploading" | "converting" | "done">("uploading")
  const [model, setModel] = useState<Model | null>(null)
  const [tfBackend, setTfBackend] = useState<Parameters<typeof setBackend>[0]>("webgpu")

  function onBackendChange(event: JSX.TargetedEvent<HTMLSelectElement, Event>) {
    if (state !== "uploading") {
      return
    }
    setTfBackend((event.target as unknown as {value: Parameters<typeof setBackend>[0]}).value)
  }

  useEffect(() => {
    if (state !== "uploading") {
      return
    }
    setModel(null)
    setBackend(tfBackend)
  }, [tfBackend])

  async function selectModel() {
    try {
      const modelDir = await window.showDirectoryPicker({id: "model"})
      const newModel = await getModel(modelDir)
      setModel(newModel)
    } catch (e) {
      setModel(null)
    }
  }

  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const newFiles = await readFileSystemHandle(fileSystemHandles, file => fileFilter(file, "MTS"))
    setFiles(files => new Map([...files, ...newFiles]))
  }
  function removeFile(path: string[]) {
    setFiles(files => updateLeaf(files, path, null))
  }

  async function doConvertAll() {
    if (model === null) {
      return
    }
    setState("converting");
    await convertAll(
      files,
      NR_WORKERS,
      (input, outputstream, onProgress) => convert(
        model, input, outputstream, onProgress),
      getOutputFilename,
      setFiles)
    setState("done")
  }

  return <>
    <h1>Detect items on videos</h1>
    <div className={css.explanation}>
    This page allows detection of items on videos, and saving the result as csv. You need to upload a YOLOv8 Web model.
    </div>
    <select disabled={state !== "uploading"} value={tfBackend} onChange={onBackendChange}>
      <option value="wasm">WASM</option>
      <option value="webgl">WebGL</option>
      <option value="webgpu">WebGPU</option>
    </select>
    <button disabled={state !== "uploading"} onClick={selectModel}>Select model</button>
    <button disabled={!(state==="uploading" && model !== null && files.size > 0)}
      onClick={doConvertAll}
      >Start conversion</button>
    <div className={css.files}>
    {files.size ? <FileTree {...{files, removeFile}} /> : "Add files to convert"}
    </div>
    {state === "uploading" && <Upload addFiles={addFiles} />}
  </>
}

