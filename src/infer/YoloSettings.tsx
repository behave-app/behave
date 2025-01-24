import { JSX } from "preact"
import {useState, useEffect} from 'preact/hooks'
import {YoloBackend, YoloSettings, YOLO_MODEL_DIRECTORY} from "../lib/tfjs-shared"
import * as infercss from "./inferrer.module.css"
import * as generalcss from "../viewer/general.module.css"
import { BooleanChecker, Checker, LiteralChecker, StringChecker, getCheckerFromObject } from "../lib/typeCheck"
import { API } from "../worker/Api"
import { valueOrErrorAsync2 } from "../lib/util"

export const YOLO_SETTINGS_STORAGE_KEY = "YoloSettingsStorageKey"

const YoloSettingsChecker: Checker<YoloSettings> = getCheckerFromObject({
  version: new LiteralChecker(1),
  backend: new LiteralChecker(["wasm", "webgpu"]),
  needsNms: new BooleanChecker(),
  modelFilename: new StringChecker(),
})

export async function loadCachedSettings(): Promise<YoloSettings | null> {
  try {
    const settingsJSON = localStorage.getItem(YOLO_SETTINGS_STORAGE_KEY)
    if (settingsJSON === null) {
      console.log("No yolo settings found")
      return null
    }
    const yoloSettings = {
      ...JSON.parse(settingsJSON)
    }
    YoloSettingsChecker.assertInstance(yoloSettings)
    await API.checkValidModel(yoloSettings)
    return yoloSettings
  } catch (e) {
    console.error("Problem retrieving settings:")
    console.error(e)
    return null
  }
}

type Props = {
  setYoloSettings: (yoloSettings: YoloSettings | null) => void
  yoloSettings: YoloSettings | null
  closeSettingsDialog: (() => void)
}

export function YoloSettingsDialog({
  setYoloSettings,
  yoloSettings,
  closeSettingsDialog,
}: Props): JSX.Element {
  const [needsNms, setNeedsNms] = useState<YoloSettings["needsNms"]>(
    yoloSettings ? yoloSettings.needsNms : true)
  const [backend, setBackend] = useState<YoloSettings["backend"]>(
    yoloSettings ? yoloSettings.backend : "webgpu")
  const [newModelFile, setNewModelFile] = useState<FileSystemFileHandle>()
  const modelFileName = newModelFile ? newModelFile.name
    : yoloSettings ? yoloSettings.modelFilename : null

  useEffect(() => {
    if (yoloSettings === null) {
      return
    }
    void(navigator.storage.getDirectory()
      .then(opfsRoot => opfsRoot.getDirectoryHandle(YOLO_MODEL_DIRECTORY))
      .then(opfsModelDir => opfsModelDir.getFileHandle(yoloSettings.modelFilename))
      .then(fileHandle => fileHandle.getFile())
      .then(file => file.arrayBuffer())
      .catch(error => {
        console.error("Error reading the model", error)
        setYoloSettings(null)
      }))
  }, [yoloSettings])

  async function save() {
    const newYoloSettings = {
      version: 1,
      backend,
      needsNms,
      modelFilename: yoloSettings ? yoloSettings.modelFilename : null
    } as Omit<YoloSettings, "modelFilename"> & {modelFilename: string | null}
    localStorage.removeItem(YOLO_SETTINGS_STORAGE_KEY)
    if (newModelFile) {
      const opfsRoot = await navigator.storage.getDirectory()
      const opfsModelDir = await opfsRoot.getDirectoryHandle(
        YOLO_MODEL_DIRECTORY, {create: true})
      const newModelName = newModelFile.name
      const file = await opfsModelDir.getFileHandle(newModelName, {create: true})
      const stream = await file.createWritable()
      const data = await (await newModelFile.getFile()).arrayBuffer()
      await stream.truncate(0)
      await stream.write(data)
      await stream.close()
      newYoloSettings.modelFilename = newModelName
    } else {
      if (newYoloSettings.modelFilename === null) {
        throw new Error("You need a model")
      }
    }
    YoloSettingsChecker.assertInstance(newYoloSettings)
      localStorage.setItem(
        YOLO_SETTINGS_STORAGE_KEY, JSON.stringify(newYoloSettings))
      setYoloSettings(newYoloSettings)
    closeSettingsDialog()
  }

  async function selectNewModelFile() {
    const result = await valueOrErrorAsync2(() => window.showOpenFilePicker({
      id: "modelpicker",
      types: [{description: "ONNX model", accept: {"application/onnx": [".onnx"]}}]
    }))
    if ("error" in result) {
      if ((result.error as DOMException).name === "AbortError") {
        console.log("Cancel clicked, do nothing")
        return
      } else {
        throw result.error
      }
    }
    const modelFiles = result.value
    if (modelFiles.length !== 1) {
      throw new Error("There should (per spec) always be exactly one file")
    }
    setNewModelFile(modelFiles[0])
  }

  if (yoloSettings === undefined) {
    return  <div>Loading yolo settings....</div>
  }

  return <>
    <div className={infercss.explanation}>
      In order to do inference, we need a model to work with.
      Please select the right settings, and upload the model.
      There is a <a href="../help/infer.html">help page</a> available.
    </div>
    <h3>Model (.onnx)</h3>
    <div>
      {modelFileName !== null
        ? <div>
          Model {modelFileName} loaded
          <button onClick={selectNewModelFile}>Change model</button>
        </div>
        : <>
          <div>Choose a model to use for inference</div>
          <button onClick={selectNewModelFile}>Select model</button>
        </>
      }
    </div>
    <h3>Backend</h3>
    <div>
      <select value={backend}
        onChange={e => setBackend(e.currentTarget.value as YoloBackend)} >
        <option value="wasm">WASM</option>
        <option value="webgpu">WebGPU</option>
      </select>
    </div>
    <h3>needsNms</h3>
    <div>
      <select value={needsNms ? "true" : "false"}
        onChange={e => setNeedsNms(e.currentTarget.value === "true")} >
        <option value="true">yes</option>
        <option value="false">no</option>
      </select>
    </div>
    <div class={generalcss.button_row}>
      <button disabled={modelFileName === null} onClick={save}>Save</button>
      <button onClick={closeSettingsDialog}>Cancel</button>
    </div>
  </>
}
