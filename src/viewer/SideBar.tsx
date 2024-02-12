import { FunctionComponent } from "preact"
import * as viewercss from "./viewer.module.css"
import * as css from "./sidebar.module.css"
import { useSelector } from "react-redux"
import {SidebarPopup, selectSidebarPopup} from "./appSlice"
import { Button } from "./PlayerInfo"
import { CONTROLS } from "./controls"
import { Icon } from "../lib/Icon"
import { selectVideoFilePotentiallyNull } from "./videoFileSlice"
import { selectRealOrDefaultSettingsByDetectionClass, selectSettingsByDetectionClassIsForCurrentSettings } from "./selectors"
import { selectDetectionInfoPotentiallyNull } from "./detectionsSlice"
import { ConfidenceLocation, SettingsForDetectionClass, alphaUpdated, confidenceCutoffUpdated, confidenceLocationUpdated, hideToggled, selectConfidenceLocation, selectSettingsByDetectionClass, settingsByDetectionClassUpdated } from "./settingsSlice"
import { useEffect } from "react"
import { useAppDispatch } from "./store"
import { joinedStringFromDict } from "../lib/util"

export const SideBar: FunctionComponent = () => {
  const popup = useSelector(selectSidebarPopup)
  return <div className={[viewercss.sidebar, css.sidebar,].join(" ")}>
    {popup && <Popup popup={popup} />}
    <div className={css.sidebar_buttons}>
      <Button controlInfo={CONTROLS.showInfo} />
      <Button controlInfo={CONTROLS.classSliders} />
      <Button controlInfo={CONTROLS.showSettings} />
    </div>
  </div>
}

const Popup: FunctionComponent<{popup: SidebarPopup}> = ({popup}) => {
  return <div class={css.popup}>{(() => {
    switch (popup) {
      case "info":
        return <Info />
      case "classSliders":
        return <ClassSliders />
      default: {
        const exhaust: never = popup
        throw new Error(`Exhausted: ${exhaust}`)
      }
    }
  })()}
  </div>
}

const Info: FunctionComponent = () => {
  const video = useSelector(selectVideoFilePotentiallyNull)
  return <>
    <h2>Behave version DEV</h2>
    <dl>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
    </dl>
    <div>TODO more info</div>
  </>
}

const ClassSliders: FunctionComponent = () => {
  const settingsByDetectionClass = useSelector(selectSettingsByDetectionClass)
  const realOrDefaultSettingsByDetectionClass = useSelector(selectRealOrDefaultSettingsByDetectionClass)
  const detectionInfo = useSelector(selectDetectionInfoPotentiallyNull)
  const isUpToDate = useSelector(selectSettingsByDetectionClassIsForCurrentSettings)
  const confidenceLocation = useSelector(selectConfidenceLocation)
  const dispatch = useAppDispatch()
  useEffect(() => {
    if (!isUpToDate && realOrDefaultSettingsByDetectionClass) {
      dispatch(settingsByDetectionClassUpdated(
        Object.fromEntries(realOrDefaultSettingsByDetectionClass.entries())))
    }
  }, [realOrDefaultSettingsByDetectionClass, isUpToDate])

  if (!settingsByDetectionClass || !detectionInfo) {
    return <div>
      Refreshing.....
    </div>
  }

  const shownTotalByClass = new Map<`${number}`, {shown: number, total: number}>(
        (Object.keys(detectionInfo.modelKlasses) as Array<`${number}`>).map(
          key => [key, {shown: 0, total: 0}]))
  detectionInfo.framesInfo.forEach(fi => {
    fi.detections.forEach(d => {
      const item = shownTotalByClass.get(`${d.klass}`)!
      item.total += 1
      if (!settingsByDetectionClass[`${d.klass}`].hide
        && d.confidence >= settingsByDetectionClass[`${d.klass}`].confidenceCutoff) {
        item.shown += 1
      }
    })
  })

  return <>
    <h2>Settings per detection class</h2>
    Confidence location:
    <select onChange={e => dispatch(confidenceLocationUpdated(
      e.currentTarget.value as ConfidenceLocation))}
      value={confidenceLocation}>
      <option value="off">off</option>
      {["outer", "inner"].flatMap(oi => ["left", "center", "right"].flatMap(lcr => [
        "top", "bottom"].map(
        tb => <option value={`${oi}-${lcr}-${tb}` as ConfidenceLocation}>
            {oi}-{lcr}-{tb}
        </option>
      )))}

    </select>
    <table className={css.class_sliders}>
      <thead>
        <tr>
          <th>class</th>
          <th>show</th>
          <th>colour</th>
          <th>cutoff (shown/total)</th>
          <th>alpha</th>
          </tr>
          </thead>
      <tbody>

        {(Object.entries(settingsByDetectionClass) as [keyof typeof settingsByDetectionClass, SettingsForDetectionClass][]).map(
          ([key, value]) => (
            <tr style={{"--class-colour": value.colour}} className={joinedStringFromDict({[css.hidden]: value.hide})}>
              <td>{key} -- {value.name}</td>
              <td>
                <span className={css.hidebox} onClick={() => dispatch(hideToggled({klass: key}))}>
                  <Icon iconName={value.hide ? "check_box_outline_blank" : "check_box"} />
                </span>
              </td>
              <td><div className={css.class_colour_box} /></td>
              <td>
                <input type="range" min={0.10} max={0.95} step={0.05}
                  disabled={value.hide}
                  value={value.confidenceCutoff}
                  onChange={e => dispatch(confidenceCutoffUpdated({
                    klass: key, newConfidenceCutoff:
                    (e.target as HTMLInputElement).valueAsNumber}))}/>
                <span class={css.range_value}>{value.confidenceCutoff.toFixed(2)}</span>
                <span className={css.counts}>({(() => {
                  const counts = shownTotalByClass.get(key)!
                  const strlen = counts.total.toString().length
                  return `${counts.shown.toString().padStart(strlen, "0")}/${counts.total}`

                })()})</span>
              </td>
              <td>
                <input type="range" min={0} max={1} step={0.1}
                  disabled={value.hide}
                  value={value.alpha}
                  onChange={e => dispatch(alphaUpdated({
                    klass: key,
                    newAlpha: (e.target as HTMLInputElement).valueAsNumber}))}/>
                <span class={css.range_value}>{value.alpha.toFixed(2)}</span>
              </td>

        </tr>
      ))}
      </tbody>
      </table>
  </>
}
