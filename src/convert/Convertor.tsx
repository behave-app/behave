import {Upload} from "../lib/Upload"
import {FileTree, FileTreeBranch, readFileSystemHandle, setStateAndConvertNextIfPossible} from "../lib/FileTree"
import * as css from "./convertor.module.css"
import { JSX } from "preact"
import {useState, useEffect} from 'preact/hooks'
import { API } from "../worker/Api"
import { isCompatibleBrowser, valueOrErrorAsync2 } from "../lib/util";

const NR_WORKERS = 1

function fileFilterForConvert(file: File): boolean | string {
  return !file.name.startsWith(".")
    && file.name.toLocaleLowerCase().endsWith(".mts")
}


export function Convertor(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [state, setState] = useState<"uploading" | "converting" | "done">("uploading")
  const [destination, setDestination] = useState<FileSystemDirectoryHandle>()

  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const newFiles = await readFileSystemHandle(
      fileSystemHandles, fileFilterForConvert)
    setFiles(files => new Map([...files, ...newFiles]))
    setState("uploading")
  }
  
  useEffect(() => {
    if (state === "uploading") {
      return
    }
    if (!destination) {
      return
    }
    setStateAndConvertNextIfPossible(
      files, NR_WORKERS, destination, API.convertToMp4, setFiles, setState)
  }, [files, destination, state])

  async function doConvertAll() {
    const result = await valueOrErrorAsync2(() => window.showDirectoryPicker(
      {id: "mp4save", mode: "readwrite"}))
    if ("error" in result) {
      if ((result.error as DOMException).name === "AbortError") {
        console.warn("Directory selection aborted, nothing happened")
        return
      }
      throw(result.error)
    }
    setDestination(result.value)
    setState("converting")
    console.log(result.value)
  }

  useEffect(() => {
    if (!isCompatibleBrowser()) {
      alert(
        "This application has only been tested to run on Chrome 121 and higher. "
          + "If you continue on your current browser, things may not work."
      )
    }

  }, [])

  return <>
    <h1>Video file convertor</h1>
    <div className={css.explanation}>
      This files converts video files to be used in the BEHAVE UI. At the moment it can only convert MTS files, but it's easy to add additional types upon request.
    </div>
    <div className={css.files}>
    {files.size ? <FileTree parentPath={[]} files={files} setFiles={setFiles} /> : <span className={css.select_files_message}>Select files to convert, either drag them into this page, or press the "Add files" button below.</span>}
    </div>
    {state !== "converting" && <Upload addFiles={addFiles} />}
    {state === "done"
    ? <div>Conversion done, feel free to add more files to convert more </div>
    : <button disabled={!(state==="uploading" && files.size > 0)}
      onClick={doConvertAll}
      >Start conversion</button>
    }
  </>
}

