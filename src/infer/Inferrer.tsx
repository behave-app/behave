import {Upload} from "../lib/Upload"
import {FileTree, FileTreeBranch, readFileSystemHandle, updateLeaf, convertAll} from "../lib/FileTree"
import * as css from "./inferrer.module.css"
import { JSX } from "preact"
import {useState} from 'preact/hooks'
import {setBackend, convert, getOutputFilename} from "./tfjs"
import {YoloSettingsDialog, YoloSettings} from "./YoloSettings"

function fileFilter(file: File, extension: string): boolean {
  return !file.name.startsWith(".") && file.name.endsWith("." + extension)
}

export function Inferrer(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [state, setState] = useState<"uploading" | "selectmodel" | "converting" | "done">("uploading")
  const [yoloSettings, setYoloSettings] = useState<YoloSettings | null>(null)


  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const newFiles = await readFileSystemHandle(fileSystemHandles, file => fileFilter(file, "MTS"))
    setFiles(files => new Map([...files, ...newFiles]))
  }
  function removeFile(path: string[]) {
    setFiles(files => updateLeaf(files, path, null))
  }

  async function doConvertAll() {
    if (!yoloSettings) {
      return
    }
    await setBackend(yoloSettings.backend)
    setState("converting");
    await convertAll(
      files,
      yoloSettings.concurrency,
      (input, outputstream, onProgress) => convert(
        yoloSettings.model, yoloSettings.yoloVersion, input, outputstream, onProgress),
      getOutputFilename,
      setFiles)
    setState("done")
  }


  return <>
    <h1>Detect items on videos</h1>
    {(!yoloSettings || state === "selectmodel")
      ?  <YoloSettingsDialog
        closeSettingsDialog={yoloSettings ? () => setState("uploading") : null}
        {...{yoloSettings, setYoloSettings}} />
      : (<>
        <div className={css.explanation}>
          This page allows detection of items on videos, and saving the result as csv. You need to upload a YOLOv8 Web model.
        </div>
        <button disabled={!(state==="uploading" && files.size > 0)}
          onClick={doConvertAll}
        >Start conversion</button>
        <button disabled={state!=="uploading"}
          onClick={() => setState("selectmodel")}
        >change model</button>
        <div className={css.files}>
          {files.size ? <FileTree {...{files, removeFile}} /> : "Add files to convert"}
        </div>
        {state === "uploading" && <Upload addFiles={addFiles} />}
      </>)}
  </>
}

