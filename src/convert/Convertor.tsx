import {Upload} from "../lib/Upload"
import {FileTree, FileTreeBranch, readFileSystemHandle, updateLeaf, convertAll} from "../lib/FileTree"
import * as css from "./convertor.module.css"
import { JSX } from "preact"
import {useState} from 'preact/hooks'
import {convert, getOutputFilename} from "./ffmpeg"
import { useEffect } from "react"
import { isCompatibleBrowser } from "../lib/util";

const NR_WORKERS = 1

function fileFilter(file: File, extension: string): boolean {
  return !file.name.startsWith(".") && file.name.endsWith("." + extension)
}


export function Convertor(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [state, setState] = useState<"uploading" | "converting" | "done">("uploading")

  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const [newFiles, rejectedFiles] = await readFileSystemHandle(
      fileSystemHandles, file => fileFilter(file, "MTS"))
    if (rejectedFiles.length) {
      alert(`${rejectedFiles.length} files were rejected, because they are not the right type. Only MTS files are accepted for now.`)
    }
    setFiles(files => new Map([...files, ...newFiles]))
  }
  function removeFile(path: string[]) {
    setFiles(files => updateLeaf(files, path, null))
  }

  async function doConvertAll() {
    setState("converting");
    await convertAll(
      files,
      NR_WORKERS,
      convert,
      getOutputFilename,
      setFiles)
    setState("done")
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
      This files converts video files to be used in BEHAVE. At the moment it can only convert MTS files, but it's easy to add additional types upon request.
    </div>
    <div className={css.files}>
    {files.size ? <FileTree {...{files, removeFile}} /> : "Add files to convert"}
    </div>
    {state === "uploading" && <Upload addFiles={addFiles} />}
    <button disabled={!(state==="uploading" && files.size > 0)}
      onClick={doConvertAll}
      >Start conversion</button>
  </>
}

