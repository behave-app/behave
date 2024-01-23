import { JSX } from "preact"
import {useState, useEffect} from 'preact/hooks'
import {YoloBackend, YoloVersion, Model, getModel, setBackend as setTFJSBackend} from "./tfjs"
import * as infercss from "./inferrer.module.css"
import {getEntry, cp_r} from "../lib/fileutil"
import {assert} from "../lib/util"

const YOLO_SETTINGS_STORAGE_KEY = "YoloSettingsStorageKey"
const YOLO_MODEL_DIRECTORY = "YoloModelDir"

export type YoloSettings = {
  version: 1,
  yoloVersion: YoloVersion,
  model: Model,
  backend: YoloBackend,
  concurrency: number,
}
export type YoloSettingsWithoutModel = Omit<YoloSettings, "model">

type Props = {
  setYoloSettings: (yoloSettings: YoloSettings | null) => void
  yoloSettings: YoloSettings | null
  closeSettingsDialog: (() => void) | null
}

async function loadModelFromOPFS(backend: YoloBackend): Promise<Model> {
  const opfsRoot = await navigator.storage.getDirectory()
  const opfsModelDir = await opfsRoot.getDirectoryHandle(YOLO_MODEL_DIRECTORY)
  await setTFJSBackend(backend)
  return await getModel(opfsModelDir)
}

export function YoloSettingsDialog({
  setYoloSettings,
  yoloSettings,
  closeSettingsDialog,
}: Props): JSX.Element {
  const [yoloVersion, setYoloVersion] = useState<YoloSettings["yoloVersion"]>("v8")
  const [concurrency, setConcurrency] = useState<YoloSettings["concurrency"]>(4)
  const [backend, setBackend] = useState<YoloSettings["backend"]>("webgl")
  const [modelDir, setModelDir] = useState<FileSystemDirectoryHandle>()

  useEffect(() => {
    if (yoloSettings === null) {
      setYoloVersion("v8")
      setConcurrency(4)
      setBackend("webgl")
      setModelDir(undefined)
    } else {
      // basically we assume that the model is still in opfs
      // Technically someone can have removed it since the last load of the site
      // If so, bad luck. This will generate an error, and that's it
      // Reload and you'll start with an empty model
      void(navigator.storage.getDirectory()
        .then(opfsRoot => opfsRoot.getDirectoryHandle(YOLO_MODEL_DIRECTORY))
        .then(opfsModelDir => {
          setYoloVersion(yoloSettings.yoloVersion)
          setConcurrency(yoloSettings.concurrency)
          setBackend(yoloSettings.backend)
          setModelDir(opfsModelDir)
        }))
    }
  }, [yoloSettings])

  useEffect(() => {
    if (yoloSettings) {
      return;
    }
    void((async () => {
      const json = localStorage.getItem(YOLO_SETTINGS_STORAGE_KEY)
      if (!json) {
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
  }, [yoloSettings])

  async function save() {
    assert(modelDir !== undefined)
    localStorage.removeItem(YOLO_SETTINGS_STORAGE_KEY)
    const newYoloSettingsWithoutModel: YoloSettingsWithoutModel = {
      version: 1,
      yoloVersion,
      backend,
      concurrency,
    }
    const opfsRoot = await navigator.storage.getDirectory()
    if (await getEntry(opfsRoot, [YOLO_MODEL_DIRECTORY])) {
      await opfsRoot.removeEntry(YOLO_MODEL_DIRECTORY, {recursive: true})
    } 
    const opfsModelDir = await opfsRoot.getDirectoryHandle(
      YOLO_MODEL_DIRECTORY, {create: true})
    await cp_r(modelDir, opfsModelDir)
    await setTFJSBackend(newYoloSettingsWithoutModel.backend)
    const model = await loadModelFromOPFS(newYoloSettingsWithoutModel.backend)
    localStorage.setItem(
      YOLO_SETTINGS_STORAGE_KEY, JSON.stringify(newYoloSettingsWithoutModel))
    const newYoloSettings = {
      ...newYoloSettingsWithoutModel, model}
    setYoloSettings(newYoloSettings)
    closeSettingsDialog && closeSettingsDialog()
  }

  async function setNewModelDir() {
    const modelDirectory = await window.showDirectoryPicker({id: "modelpicker"})

    try {
      await setTFJSBackend(backend)
      await getModel(modelDirectory)
    } catch (e) {
      console.log("opening of model failed", e)
      window.alert("Opening of model failed; either the directory pointed to does not contain a valid model, or backend is not supported")
      return
    }
    setModelDir(modelDirectory)
  }

  if (yoloSettings === undefined) {
    return  <></>
  }

  return <>
    <div className={infercss.explanation}>
      In order to do inference, we need a model to work with.
      Please upload the model, and the settings.
    </div>
    <dl>
      <dt>Concurrency</dt>
      <dd>
        <input type="range" value={concurrency} min={1} max={10} step={1}
          onInput={e => setConcurrency(parseInt(e.currentTarget.value))} /> ({concurrency})
      </dd>
      <dt>Backend</dt>
      <dd>
        <select value={backend}
          onChange={e => setBackend(e.currentTarget.value as YoloBackend)} >
          <option value="wasm">WASM</option>
          <option value="webgl">WebGL</option>
          <option value="webgpu">WebGPU</option>
        </select>
      </dd>
      <dt>Yolo version</dt>
      <dd>
        <select value={yoloVersion}
          onChange={e => setYoloVersion(
            e.currentTarget.value as YoloSettings["yoloVersion"])} >
          <option value="v5">YOLOv5</option>
          <option value="v8">YOLOv8</option>
        </select>
      </dd>
      <dt>Model</dt>
      <dd>
        {modelDir !== undefined
          ? <div>
            Model loaded
            <button onClick={setNewModelDir}>Change model</button>
            </div>
          : <>
            <div>No model selected, load one here</div>
            <button onClick={setNewModelDir}>Select model</button>
          </>
        }
      </dd>
    </dl>
    <button disabled={modelDir === undefined} onClick={save}>Save</button>
    {closeSettingsDialog &&
      <button onClick={closeSettingsDialog}>Cancel</button>
    }
  </>
}
