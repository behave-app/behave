import "preact/debug"
import {Upload} from "../lib/Upload"
import {FileTree, FileTreeBranch, readFileSystemHandle, updateLeaf, convertAll} from "../lib/FileTree"
import * as css from "./inferrer.module.css"
import { JSX } from "preact"
import {useState} from 'preact/hooks'
import {setBackend, convert, getOutputFilename} from "./tfjs"
import {YoloSettingsDialog, YoloSettings, YOLO_SETTINGS_STORAGE_KEY, YoloSettingsWithoutModel, loadModelFromOPFS} from "./YoloSettings"
import { useEffect } from "react"
import { isCompatibleBrowser } from "../lib/util";

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
    if (yoloSettings) {
      await setBackend(yoloSettings.backend)
    }
    setState("converting");
    const {concurrency, model, yoloVersion} = yoloSettings ?? {
      concurrency: 1, model: null, yoloVersion: "v8"}
    await convertAll(
      files,
      concurrency,
      (input, outputstream, onProgress) => convert(
        model, yoloVersion, input, outputstream, onProgress),
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

  useEffect(() => {
    void((async () => {
      const json = localStorage.getItem(YOLO_SETTINGS_STORAGE_KEY)
      if (json === null) {
        setYoloSettings(null)
        return
      }
      try {
        const ys = JSON.parse(json) as YoloSettingsWithoutModel
        const model = await loadModelFromOPFS(ys.backend)
        setYoloSettings({...ys, model})
      } catch (e) {
        console.error("Something went wrong with retrieving yolo settings")
        console.error(e)
        setYoloSettings(null)
      }
    })())
  }, [])



  return <>
    <h1>Detect items on videos</h1>
    {(state === "selectmodel")
      ?  <YoloSettingsDialog
        closeSettingsDialog={() => setState("uploading")}
        {...{yoloSettings, setYoloSettings}} />
      : (<>
        <div className={css.explanation}>
          This page allows detection of items on videos, and saving the result as csv. You need to upload a YOLOv8 Web model.
        </div>
        {yoloSettings ? <div className={css.explanation}>
          Loaded model: {yoloSettings.model.name} ({yoloSettings.yoloVersion} / {yoloSettings.backend})
        </div> : <div className={css.explanation}>
            At the moment no yolo model is selected. Running this way means that no
            detection is done on the videos. It means you can still use all the
            tools in Behave, you just don't have any detections.
        </div>}
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

