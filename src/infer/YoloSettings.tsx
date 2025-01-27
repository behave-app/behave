import { JSX } from "preact"
import {useState, useEffect} from 'preact/hooks'
import {yoloBackends, YoloBackend, YoloSettings, YOLO_MODEL_DIRECTORY, getSavedModelFileHandleFromName} from "../lib/tfjs-shared"
import * as infercss from "./inferrer.module.css"
import * as generalcss from "../lib/general.module.css"
import { BooleanChecker, Checker, LiteralChecker, StringChecker, getCheckerFromObject } from "../lib/typeCheck"
import { API } from "../worker/Api"
import { ObjectEntries, ObjectKeys, assert, formatRoundedTimeHumanFriendly, joinedStringFromDict, valueOrErrorAsync2 } from "../lib/util"
import { Icon } from "../lib/Icon"

export const YOLO_SETTINGS_STORAGE_KEY = "YoloSettingsStorageKey"

const YoloSettingsChecker: Checker<YoloSettings> = getCheckerFromObject({
  version: new LiteralChecker(1),
  autoConfigured: new BooleanChecker,
  backend: new LiteralChecker(ObjectKeys(yoloBackends)),
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
  const [autoConfigureLoading, setAutoConfigureLoading] = useState<number>(NaN)
  const [autoConfigResults, setAutoConfigResults] = useState<Record<YoloSettings["backend"], {msPerInfer: number} | {error: Error}>>()
  const [testLoading, setTestLoading] = useState<number>(NaN)
  const [testResult, setTestResult] = useState<{msPerInfer: number} | {error: Error}>()

  const [autoConfigured, setAutoConfigured] = useState<boolean>(yoloSettings ? yoloSettings.autoConfigured : true)
  const [needsNms, setNeedsNms] = useState<YoloSettings["needsNms"]>(
    yoloSettings ? yoloSettings.needsNms : true)
  const [backend, setBackend] = useState<YoloBackend | "none">(
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

  useEffect(() => {


  })

  async function save() {
    assert(backend !== "none")
    const newYoloSettings: Omit<YoloSettings, "modelFilename"> & {modelFilename: string | null} = {
      version: 1,
      backend,
      needsNms,
      autoConfigured,
      modelFilename: yoloSettings ? yoloSettings.modelFilename : null
    } 
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
    assert(modelFiles.length === 1)
    setNewModelFile(modelFiles[0])
    setAutoConfigResults(undefined)
    setTestResult(undefined)
    setAutoConfigureLoading(NaN)
    setTestLoading(NaN)
  }

  useEffect(() => {
    if (!autoConfigured) {
      setTestLoading(NaN)
      setTestResult(undefined)
    }
  }, [backend, needsNms, autoConfigured])

  useEffect(() => {
    if (newModelFile && autoConfigured) {
      void(startAutoConfigure())
    }
  }, [newModelFile])

  const startAutoConfigure = async () => {
    setAutoConfigureLoading(0)
    setAutoConfigResults(undefined)
    const modelFile = newModelFile ?? (yoloSettings ? await getSavedModelFileHandleFromName(yoloSettings.modelFilename) : null)
    if (modelFile === null) {
      return
    }
    const results = await API.autoConfigureAndTestModel(
      modelFile, progress => {setAutoConfigureLoading(progress)})
    setNeedsNms(results.modelNeedsNms)
    const [bestBackend, _speed] = ObjectEntries(results.performance).reduce(
      ([bestBackend, speed], [newBackend, result]) =>
        ("error" in result || result.msPerInfer > speed)
          ? [bestBackend, speed] : [newBackend, result.msPerInfer],
      ["none" as YoloBackend | "none", NaN])
    setBackend(bestBackend)
    setAutoConfigResults(results.performance)
    setAutoConfigureLoading(NaN)
  }

  const startTest = async () => {
    if (backend === "none") {
      return
    }
    setTestLoading(0)
    setTestResult(undefined)
    const modelFile = newModelFile ?? (yoloSettings ? await getSavedModelFileHandleFromName(yoloSettings.modelFilename) : null)
    if (modelFile === null) {
      return
    }
    const result = await API.testModel(
      modelFile, backend, needsNms, progress => {setTestLoading(progress)})
    setTestResult(result)
    setTestLoading(NaN)
  }

  if (yoloSettings === undefined) {
    return  <div>Loading yolo settings....</div>
  }

  const showAutoSettingsLoading = autoConfigured && isFinite(autoConfigureLoading)
  const showTestLoading = isFinite(testLoading)

  return <>
    <div>
      <div className={infercss.step}>
        <h3>Choose a model (.onnx)</h3>
        <div>
          {modelFileName !== null
            ? <div className={infercss.model_selector}>
              <Icon iconName="draft" />
              <span>{modelFileName}</span>
              <button className={generalcss.buttonWhite} onClick={selectNewModelFile}>Change model</button>
            </div>
            : <div className={infercss.model_selector}>
              <Icon iconName="upload" />
              <span>No model selected</span>
              <button className={generalcss.buttonWhite} onClick={selectNewModelFile}>Select model</button>
            </div>
          }
        </div>
        <div className={infercss.settingsLine}>
          <input type="checkbox"
            className={generalcss.ios_switch}
            id="autoConfigure"
            checked={!autoConfigured}
            onChange={() => {
              if (autoConfigured === false && (yoloSettings || newModelFile)) {
                void(startAutoConfigure())
              }
              setAutoConfigured(!autoConfigured)
            }}
          />
          <label for="autoConfigure">Manually adjust model setting (advanced)</label>
        </div>
      </div>
      <div className={infercss.step}>
        <h3>{autoConfigured ? "Automatically chosen settings" : "Adjust the settings"}</h3>
        {showAutoSettingsLoading && <div className={infercss.loading_overlay}><span className={generalcss.spinner} /> determining optimal settings for the model ({(autoConfigureLoading * 100).toFixed(0)}%)</div>}
        <div className={joinedStringFromDict({
          [infercss.settingsLine]: true,
          [infercss.hide]: showAutoSettingsLoading
        })}>
          Backend:
          <select value={backend}
            disabled={autoConfigured}
            onChange={e => !autoConfigured && setBackend(e.currentTarget.value as YoloBackend)} >
            {backend === "none" && <option value="none">No compatible backend found</option>}
            {ObjectEntries(yoloBackends).map(
              ([key, label]) =><option value={key}>{label}</option>)}
          </select>
        </div>
        <div className={joinedStringFromDict({
          [infercss.settingsLine]: true,
          [infercss.hide]: showAutoSettingsLoading
        })}>
          Needs nms post-model step:
          <select value={needsNms ? "true" : "false"}
            disabled={autoConfigured}
            onChange={e => !autoConfigured && setNeedsNms(e.currentTarget.value === "true")} >
            <option value="true">yes</option>
            <option value="false">no</option>
          </select>
        </div>
        {autoConfigured && autoConfigResults && <div className={infercss.test_result}>
          {backend === "none" && <>BEHAVE was unable to find settings that allow this model to run. Please see <a href="../model-faq.html">the Model FAQ</a> for more information.</>}
          <h4>Test report</h4>
          <ul>
            {ObjectEntries(autoConfigResults).map(
              ([backend, result]) => <li><dl>
                <dt>backend</dt><dd>{yoloBackends[backend]}</dd>
                <dt>model load</dt><dd>{"msPerInfer" in result ? "success" : "error"}</dd>
                {"msPerInfer" in result
                  ? <><dt>speed</dt>
                    <dd>{formatRoundedTimeHumanFriendly(result.msPerInfer / 1000)} per frame</dd>
                    <dt>full video<sup>1</sup></dt><dd>&#x2248; {formatRoundedTimeHumanFriendly(result.msPerInfer / 1000 * 30 * 60 * 25)}</dd>
                  </>
                  : <><dt>error</dt><dd>{result.error.toString()}</dd></>
                }
              </dl></li>)}
          </ul>
          {backend !== "none" && <div>Selected backend: {yoloBackends[backend]}</div>}
          <div className={infercss.footnote}><sup>1</sup> Assumes a video of 30 minutes, 25 frames per minute, 45,000 frames in total.</div>
        </div>}
      </div>
      {!autoConfigured && 
        <div className={infercss.step}>
          <h3>Test the model</h3>
          {backend === "none"
            ? <>First choose a backend</>
            : showTestLoading
              ? <div><span className={generalcss.spinner} /> testing the settings ({(testLoading * 100).toFixed(0)}%)</div>
              : <>
                <button className={generalcss.buttonWhite} onClick={() => startTest()} disabled={isFinite(testLoading)}>Run test</button>
                {testResult && <div className={infercss.test_result}>
                  <h4>Test report</h4>
                  <ul>
                    <li><dl>
                      <dt>backend</dt><dd>{yoloBackends[backend]}</dd>
                      <dt>model load</dt><dd>{"msPerInfer" in testResult ? "success" : "error"}</dd>
                      {"msPerInfer" in testResult
                        ? <><dt>speed</dt>
                          <dd>{formatRoundedTimeHumanFriendly(testResult.msPerInfer / 1000)} per frame</dd>
                          <dt>full video<sup>1</sup></dt><dd>&#x2248; {formatRoundedTimeHumanFriendly(testResult.msPerInfer / 1000 * 30 * 60 * 25)}</dd>
                        </>
                        : <><dt>error</dt><dd>{testResult.error.toString()}</dd></>
                      }
                    </dl></li>
                  </ul>
                  <div className={infercss.footnote}><sup>1</sup> Assumes a video of 30 minutes, 25 frames per minute, 45,000 frames in total.</div>
                </div>
                }
              </>
          }
        </div>
      }
    </div>
    <div class={generalcss.button_row}>
      <button disabled={
        backend === "none"  // no backend was selected
          || modelFileName === null  // no model file was selected
          || (autoConfigured && !isNaN(autoConfigureLoading)) // finish auto-configure
          || (!autoConfigured && (!isNaN(testLoading) || !testResult || "error" in testResult)) // make sure configuration was tested
      } className={generalcss.buttonBlack} onClick={save}>Save</button>
      <button className={generalcss.buttonBlack} onClick={closeSettingsDialog}>Cancel</button>
    </div>
  </>
}
