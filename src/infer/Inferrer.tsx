import "preact/debug"
import {Upload} from "../lib/Upload"
import {FileTree, FileTreeBranch, readFileSystemHandle, setStateAndConvertNextIfPossible } from "../lib/FileTree"
import * as css from "./inferrer.module.css"
import { JSX } from "preact"
import {useState} from 'preact/hooks'
import {YoloSettingsDialog, loadCachedSettings} from "./YoloSettings"
import { useEffect } from "react"
import { isCompatibleBrowser, valueOrErrorAsync2 } from "../lib/util";
import { Icon } from "../lib/Icon"
import { API } from "../worker/Api"
import { YoloSettings } from "../lib/tfjs-shared"
import { EXTENSIONSMATCH } from "../lib/constants"

function fileFilterForInfer(file: File): boolean | string {
  if (file.name.startsWith(".")) {
    return false
  }
  const validExtensionsMatch = [EXTENSIONSMATCH.videoSourceMts, EXTENSIONSMATCH.videoSourceMp4]
  if (!validExtensionsMatch.some(ext => ext.test(file.name))) {
    return false
  }
  if (EXTENSIONSMATCH.notVideoSource.test(file.name)) {
    return "Use the original video file, not the result of convert"
  }
  return true
}

export function Inferrer(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [concurrency, setConcurrency] = useState(1)
  const [modelName, setModelName] = useState<string | null>(null)
  const [state, setState] = useState<"uploading" | "selectmodel" | "converting" | "done">("uploading")
  const [yoloSettings, setYoloSettings] = useState<YoloSettings | null>(null)
  const [destination, setDestination] = useState<FileSystemDirectoryHandle>()


  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const newFiles = await readFileSystemHandle(
      fileSystemHandles, fileFilterForInfer)
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
      files, concurrency, destination, 
      async (input, output, onProgress, forceOverwrite) => API.inferVideo(
        yoloSettings, input, output, onProgress, forceOverwrite),
      setFiles, setState)
  }, [files, destination, state, concurrency])


  async function doConvertAll() {
    const result = await valueOrErrorAsync2(() => window.showDirectoryPicker(
      {id: "det-json-save", mode: "readwrite"}))
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

  useEffect(() => {
    void(loadCachedSettings().then(settings => setYoloSettings(settings)))
  }, [])

  useEffect(() => {
    if (!yoloSettings) {
      setModelName(null)
      return;
    }
    void(API.checkValidModel(yoloSettings.backend, yoloSettings.modelDirectory).then(response => setModelName(response.name)))
  }, [yoloSettings])

  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
  const [preventSleep, setPreventSleep] = useState(false)

  useEffect(() => {
    if (!preventSleep || state !== "converting" || wakeLock) {
      return
    }
    let localWakeLock: WakeLockSentinel | null = null
    void(navigator.wakeLock.request("screen").then(wakeLock => {
      localWakeLock = wakeLock;
      localWakeLock.addEventListener("release", wakelockReleased)
      setWakeLock(wakeLock)
      console.log("lock created")
    }))
    const wakelockReleased = async () => {
      console.log("lock release")
      if (localWakeLock) {
        localWakeLock.removeEventListener("release", wakelockReleased)
        localWakeLock = null
        setWakeLock(null)
      }
    }
    const restoreWakelock = async () => {
      if (document.visibilityState === "visible") {
        localWakeLock = await navigator.wakeLock.request("screen");
        localWakeLock.addEventListener("release", wakelockReleased)
        setWakeLock(localWakeLock)
        console.log("lock recovered")
      }
    }
    document.addEventListener("visibilitychange", restoreWakelock)
    return () => {
      document.removeEventListener("visibilitychange", restoreWakelock)
      if (localWakeLock) {
        void(localWakeLock.release().then(() => {
          console.log("lock destroyed")
        }))
      }
    }
  }, [preventSleep, state])

  return <>
    <h1>Infer videos (detect items)</h1>
    {(state === "selectmodel")
      ?  <YoloSettingsDialog
        closeSettingsDialog={() => setState("uploading")}
        {...{yoloSettings, setYoloSettings}} />
      : (<>
        <div className={css.explanation}>
          This page allows detection of items on videos, and saving the result as a json file.
          You will need to upload a model, check the settings, and add a video file.
          Check the <a href="../help/infer.html">help page</a> or the <a href="../help/quickstart.html">quick start guide</a> for more information.
        </div>
        {yoloSettings ? <div className={css.explanation}>
          Loaded model: {modelName !== null ? modelName : "<loading>"} ({yoloSettings.yoloVersion} / {yoloSettings.backend}) <button disabled={state!=="uploading"}
            onClick={() => setState("selectmodel")}
          >change</button>
        </div> : <div className={css.explanation}>
            At the moment no yolo model is selected. Please add a model in order to start.
            <button disabled={state!=="uploading"}
              onClick={() => setState("selectmodel")}
            >add a model</button>
          </div>}
        <div>
          Concurrency:
          <input type="range" value={concurrency} min={1} max={10} step={1}
            onInput={e => setConcurrency(parseInt(e.currentTarget.value))} /> ({concurrency} file{concurrency ===1 ? " is"  : "s are"} getting processed at the same time) 
        </div>
        <div>
          <button className={css.checkbox}
            onClick={() => setPreventSleep(x => !x)}>
            <Icon iconName={preventSleep ? "check_box" : "check_box_outline_blank"}
            />
          </button>
          Prevent sleep while inference is running.
        </div>
        <div className={css.files}>
          {files.size ? <FileTree parentPath={[]} files={files} setFiles={setFiles} /> : <span className={css.select_files_message}>Select files to infer, either drag them into this page, or press the "Add files" button below.</span>}
        </div>
        {state !== "converting" && <Upload addFiles={addFiles} />}
        {state === "done"
          ? <div>Inference done, feel free to add more files to convert more </div>
          : <button disabled={!(state==="uploading" && files.size > 0)}
            onClick={doConvertAll}
          >Start inference</button>
        }
      </>)}
  </>
}

