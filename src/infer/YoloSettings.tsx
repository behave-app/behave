import { JSX } from "preact"
import {useState, useEffect} from 'preact/hooks'
import {YoloBackend, YoloSettings, YOLO_MODEL_NAME_FILE} from "../lib/tfjs-shared"
import * as infercss from "./inferrer.module.css"
import {getEntry, cp_r} from "../lib/fileutil"
import { Checker, LiteralChecker, TypeChecker, getCheckerFromObject } from "../lib/typeCheck"
import { API } from "../worker/Api"


export const YOLO_SETTINGS_STORAGE_KEY = "YoloSettingsStorageKey"
const YOLO_MODEL_ZIP_FILE = "YoloModel.zip"

const YoloSettingsChecker: Checker<YoloSettings> = getCheckerFromObject({
  version: new LiteralChecker(1),
  yoloVersion: new LiteralChecker(["v5", "v8"]),
  backend: new LiteralChecker(["wasm", "webgl", "webgpu"]),
  modelDirectory: new TypeChecker(FileSystemDirectoryHandle),
})

export async function loadCachedSettings(): Promise<YoloSettings | null> {
  try {
    const opfsRoot = await navigator.storage.getDirectory()
    const modelZipFileHandle = await opfsRoot.getDirectoryHandle(YOLO_MODEL_ZIP_FILE)

    const settings = {
      ...JSON.parse(localStorage.getItem(YOLO_SETTINGS_STORAGE_KEY)!),
      modelZipFileHandle,
    }
    YoloSettingsChecker.assertInstance(settings)
    await API.checkValidModel(settings.backend, modelZipFileHandle)
    return settings
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
  const [modelName, setModelName] = useState<string>()
  const [backend, setBackend] = useState<YoloSettings["backend"]>("webgl")
  const [modelZipFileHandle, setModelZipFileHandle] = useState<FileSystemFileHandle>()

  useEffect(() => {
    if (yoloSettings === null) {
      setModelName(undefined)
      setBackend("webgl")
      setModelZipFileHandle(undefined)
    } else {
      // basically we assume that the model is still in opfs
      // Technically someone can have removed it since the last load of the site
      // If so, bad luck. This will generate an error, and that's it
      // Reload and you'll start with an empty model
      void(navigator.storage.getDirectory()
        .then(opfsRoot => opfsRoot.getFileHandle(YOLO_MODEL_ZIP_FILE))
        .then(opfsModelDir => {
          setYoloVersion(yoloSettings.yoloVersion)
          setBackend(yoloSettings.backend)
          setModelDir(opfsModelDir)
        }))
    }
  }, [yoloSettings])

  async function save() {
    if (modelName === undefined) {
      throw new Error("Cannot be called with 'null' modelName")
    }
    localStorage.removeItem(YOLO_SETTINGS_STORAGE_KEY)
    const newYoloSettingsWithoutModel: Omit<YoloSettings, "modelZipFileHandle"> = {
      version: 1,
      modelName,
      backend,
    }
    const opfsRoot = await navigator.storage.getDirectory()
    const modelDirIsOnUsersFilesystem /*as opposed to in OPFS*/ =
      modelDir && !await opfsRoot.resolve(modelDir)
    if (!modelDir) {
      if (await getEntry(opfsRoot, [YOLO_MODEL_DIRECTORY])) {
        await opfsRoot.removeEntry(YOLO_MODEL_DIRECTORY, {recursive: true})
      } 
      localStorage.removeItem(YOLO_SETTINGS_STORAGE_KEY)
      setYoloSettings(null)
    } else {
      if (modelDirIsOnUsersFilesystem) {
        await API.checkValidModel(backend, modelDir)
        if (await getEntry(opfsRoot, [YOLO_MODEL_DIRECTORY])) {
          await opfsRoot.removeEntry(YOLO_MODEL_DIRECTORY, {recursive: true})
        } 
        const opfsModelDir = await opfsRoot.getDirectoryHandle(
          YOLO_MODEL_DIRECTORY, {create: true})
        await cp_r(modelDir, opfsModelDir)
        if (!await getEntry(opfsModelDir, [YOLO_MODEL_NAME_FILE])) {
          const modelNameHandle = await opfsModelDir.getFileHandle(
            YOLO_MODEL_NAME_FILE, {create: true})
          const os = await modelNameHandle.createWritable()
          await os.write(modelDir.name)
          await os.close()
        }
      }
      localStorage.setItem(
        YOLO_SETTINGS_STORAGE_KEY, JSON.stringify(newYoloSettingsWithoutModel))
      const opfsModelDir = await opfsRoot.getDirectoryHandle(YOLO_MODEL_DIRECTORY)
      await API.checkValidModel(backend, opfsModelDir)

      const newYoloSettings = {
        ...newYoloSettingsWithoutModel, modelDirectory: opfsModelDir}
      setYoloSettings(newYoloSettings)
    }
    closeSettingsDialog()
  }

  async function unloadModelDir() {
    setModelDir(undefined)
  }

  async function setNewModelDir() {
    const modelDirectory = await window.showDirectoryPicker({id: "modelpicker"})

    try {
      await API.checkValidModel(backend, modelDirectory)
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
            <button onClick={unloadModelDir}>Unload model</button>
            </div>
          : <>
            <div>No model selected, load one here (or continue without a model)</div>
            <button onClick={setNewModelDir}>Select model</button>
          </>
        }
      </dd>
    </dl>
    <button onClick={save}>Save</button>
    <button onClick={closeSettingsDialog}>Cancel</button>
  </>
}
