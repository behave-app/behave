import "preact/debug"
import {Upload} from "../lib/Upload"
import {FileTree, FileTreeBranch, hasNotWrongFiletypeErrors, hasWrongFiletypeErrors, readFileSystemHandle, setStateAndConvertNextIfPossible} from "../lib/FileTree"
import * as css from "./inferrer.module.css"
import { JSX } from "preact"
import {useState} from 'preact/hooks'
import * as generalcss from "../lib/general.module.css"
import {YoloSettingsDialog, loadCachedSettings} from "./YoloSettings"
import { useEffect } from "react"
import { isCompatibleBrowser, joinedStringFromDict, range, valueOrErrorAsync2 } from "../lib/util";
import * as filetreecss from "../lib/filetree.module.css"
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

type State ="loadingYoloSettings" | "selectmodel" | "uploading" | "converting" | "done"  | undefined

export function Inferrer(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [concurrency, setConcurrency] = useState(1)
  const [state, setState] = useState<State>()
  const [yoloSettings, setYoloSettings] = useState<YoloSettings | null>(null)
  const [destination, setDestination] = useState<FileSystemDirectoryHandle>()

  const wrongFiletypeErrors = hasWrongFiletypeErrors(files)
  const otherErrors = hasNotWrongFiletypeErrors(files)


  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const newFiles = await readFileSystemHandle(
      fileSystemHandles, fileFilterForInfer)
    setFiles(files => new Map([...files, ...newFiles]))
    setState("uploading")
  }

  useEffect(() => {
    if (!yoloSettings) {
      return
    }
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
  }, [files, destination, state, concurrency, yoloSettings])


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
    if (state === undefined) {
      setState("loadingYoloSettings")
      void(loadCachedSettings().then(settings => {
        setYoloSettings(settings)
        setState("uploading")
      }
      ))
    }
  }, [])

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

  async function selectFilesToAdd() {
    const files = await window.showOpenFilePicker({multiple: true})
    void(addFiles(files))
  }

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
        {wrongFiletypeErrors && <div class={filetreecss.note_information}>
          You have added some files with an unsupported extension.
          We may be able to add support for this file
          type, <a target="_blank" href="../help/infer-faq.html">read more here</a>.
        </div>}
        {otherErrors && <div class={filetreecss.note_information}>
          Some infer sessions seem to have failed.
          Please consult <a target="_blank" href="../help/infer-faq.html">our infer FAQ</a> for possible reasons for the failure.
        </div>}
        <div>
          <div className={css.yoloSettingsBox}>
            {state === undefined || state === "loadingYoloSettings"
              ? <div className={css.looking_for_model}><span className={generalcss.spinner} /> Loading previously selected model</div>
              :<>
                <dl>
                  <dt>Loaded Model</dt>
                  <dd>
                    {yoloSettings
                      ? <>{yoloSettings.modelFilename} ({yoloSettings.backend})</>
                      : "<no model>"
                    }
                  </dd>
                </dl>
                <button disabled={state!=="uploading"}
                  className={generalcss.buttonWhite}
                  onClick={() => setState("selectmodel")}
                >{yoloSettings ? "Change" : "Add"} Model</button>
              </>}
          </div>
          <div className={joinedStringFromDict({
            [css.infer_settings]: true,
            [css.step_disabled]: !yoloSettings})}>
            <div>
              Concurrency: process <select value={concurrency}
                onInput={e => setConcurrency(parseInt(e.currentTarget.value))}>
                {range(8).map(i => <option value={i + 1}>{i + 1}</option>)}
              </select> file{concurrency !== 1 && "s"} at the same time
            </div>
            <div>
              <input type="checkbox" className={generalcss.ios_switch}
                checked={preventSleep}
                onClick={() => setPreventSleep(!preventSleep)} />
              Prevent sleep while inference is running.
            </div>
          </div>
          <div className={joinedStringFromDict({
            [generalcss.files_dropper]: true,
            [css.step_disabled]: !yoloSettings})}>
            {files.size
              ? <FileTree parentPath={[]} files={files} setFiles={setFiles} />
              : <div className={generalcss.select_files_message}>
                <Icon iconName="upload" />
                <div>Drag & drop video files here or click below</div>
                <button className={generalcss.buttonBlack} onClick={selectFilesToAdd}>Add Files</button>
              </div>}
          </div>
        </div>
        <Upload addFiles={addFiles} />
        <div className={css.startInferenceButtonLine}>
          <button
            disabled={!(state==="uploading" && files.size > 0 && yoloSettings)}
            className={generalcss.buttonBlack}
            onClick={doConvertAll}
          >{state === "done" ? "Inference Done"
              : state === "converting" ? "Infering..."
                : "Start Inference"}</button>
        </div>
      </>)}
  </>
}

