import "preact/debug"
import {Upload} from "../lib/Upload"
import {FileTree, FileTreeBranch, readFileSystemHandle, updateLeaf, convertAll} from "../lib/FileTree"
import * as css from "./inferrer.module.css"
import { JSX } from "preact"
import {useState} from 'preact/hooks'
import {YoloSettingsDialog, loadCachedSettings} from "./YoloSettings"
import { useEffect } from "react"
import { getBehaveVersion, isCompatibleBrowser } from "../lib/util";
import { Icon } from "../lib/Icon"
import { API } from "../worker/Api"
import { YoloSettings } from "../lib/tfjs-shared"

function fileFilter(file: File, extensions: string[]): boolean {
  return !file.name.startsWith(".") && extensions.some(
    extension => file.name.toUpperCase().endsWith("." + extension.toUpperCase()))
}

export function Inferrer(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [concurrency, setConcurrency] = useState(2)
  const [modelName, setModelName] = useState<string | null>(null)
  const [state, setState] = useState<"uploading" | "selectmodel" | "converting" | "done">("uploading")
  const [yoloSettings, setYoloSettings] = useState<YoloSettings | null>(null)


  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const [newFiles, rejectedFiles] = await readFileSystemHandle(
      fileSystemHandles, file => fileFilter(file, ["MP4", "MTS"]))
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
      concurrency,
      async (input, output, onProgress) => API.inferVideo(
        yoloSettings, input, output, onProgress),
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
    <h1>Detect items on videos</h1>
    {(state === "selectmodel")
      ?  <YoloSettingsDialog
        closeSettingsDialog={() => setState("uploading")}
        {...{yoloSettings, setYoloSettings}} />
      : (<>
        <div className={css.version}>{getBehaveVersion()}</div>
        <div className={css.explanation}>
          This page allows detection of items on videos, and saving the result as csv (inference).
        </div>
        {yoloSettings ? <div className={css.explanation}>
          Loaded model: {modelName !== null ? modelName : "<loading>"} ({yoloSettings.yoloVersion} / {yoloSettings.backend}) <button disabled={state!=="uploading"}
          onClick={() => setState("selectmodel")}
        >change</button>
        </div> : <div className={css.explanation}>
            At the moment no yolo model is selected. Running this way means that no
            detection is done on the videos. It means you can still use all the
            tools in Behave, you just don't have any detections.
            <button disabled={state!=="uploading"}
              onClick={() => setState("selectmodel")}
            >add a model</button>
          </div>}
        <div>
      Concurrency ({concurrency} file{concurrency !==1 && "s"} at the same time):
        <input type="range" value={concurrency} min={1} max={10} step={1}
          onInput={e => setConcurrency(parseInt(e.currentTarget.value))} /> ({concurrency})
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
          <FileTree {...{files, removeFile}} />
          {state === "uploading" && <Upload addFiles={addFiles} />}
        </div>
        <button className={css.single_button} disabled={!(state==="uploading" && files.size > 0)}
          onClick={doConvertAll}
        >Start inference</button>
      </>)}
  </>
}

