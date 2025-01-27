import {Upload} from "../lib/Upload"
import {FileTree, FileTreeBranch, hasNotWrongFiletypeErrors, hasWrongFiletypeErrors, readFileSystemHandle, setStateAndConvertNextIfPossible} from "../lib/FileTree"
import * as css from "./convertor.module.css"
import * as filetreecss from "../lib/filetree.module.css"
import * as generalcss from "../lib/general.module.css"
import { JSX } from "preact"
import {useState, useEffect} from 'preact/hooks'
import { API } from "../worker/Api"
import { isCompatibleBrowser, valueOrErrorAsync2 } from "../lib/util";
import { Icon } from "../lib/Icon"

const NR_WORKERS = 1

function fileFilterForConvert(file: File): boolean | string {
  return !file.name.startsWith(".")
    && file.name.toLocaleLowerCase().endsWith(".mts")
}


export function Convertor(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [state, setState] = useState<"uploading" | "converting" | "done">("uploading")
  const [destination, setDestination] = useState<FileSystemDirectoryHandle>()

  const wrongFiletypeErrors = hasWrongFiletypeErrors(files)
  const otherErrors = hasNotWrongFiletypeErrors(files)

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
  }

  useEffect(() => {
    if (!isCompatibleBrowser()) {
      alert(
        "This application has only been tested to run on Chrome 121 and higher. "
          + "If you continue on your current browser, things may not work."
      )
    }

  }, [])

  async function selectFilesToAdd() {
    const files = await window.showOpenFilePicker({multiple: true})
    void(addFiles(files))
  }

  return <>
    <h1>Video file convertor</h1>
    <div className={css.explanation}>
      This files converts video files to be used in the BEHAVE UI. Please <a href="../help/convert-faq.html">read here</a> about what convert does, and which video formats are supported.
    </div>
    {wrongFiletypeErrors && <div class={filetreecss.note_information}>
      You have added some files with an unsupported extension.
      We may be able to add support for this file
      type, <a target="_blank" href="../help/convert-faq.html">read more here</a>.
    </div>}
    {otherErrors && <div class={filetreecss.note_information}>
      Some converts seem to have failed.
      It may be that we don't yet support the exact video format you are trying to convert, but we may be happy to add it if we know people need it.
      Read more <a target="_blank" href="../help/convert-faq.html">in our FAQ</a>.
    </div>}
    <div className={generalcss.files_dropper}>
      {files.size
        ? <FileTree parentPath={[]} files={files} setFiles={setFiles} />
        : <div className={generalcss.select_files_message}>
          <Icon iconName="upload" />
          <div>Drag & drop video files here or click below</div>
          <button className={generalcss.buttonBlack} onClick={selectFilesToAdd}>Add Files</button>
        </div>}
    </div>
    <Upload addFiles={addFiles} />

    <div className={css.startConversionButtonLine}>
      <button disabled={!(state==="uploading" && files.size > 0)}
        className={generalcss.buttonBlack}
        onClick={doConvertAll}
      >{state === "done" ? "Conversion Done"
          : state === "converting" ? "Converting..."
            : "Start Conversion"}</button>
    </div>
  </>
}

