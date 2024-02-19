import { FunctionComponent } from "react"
import { useSelector } from "react-redux"
import { selectRealOrDefaultSettingsByDetectionClass, selectSettingsByDetectionClassIsForCurrentSettings } from "./selectors"
import { selectDetectionInfoPotentiallyNull } from "./detectionsSlice"
import { ConfidenceLocation, SettingsForDetectionClass, alphaUpdated, colourUpdated, confidenceCutoffUpdated, confidenceLocationUpdated, hideToggled, selectConfidenceLocation, selectSettingsByDetectionClass, settingsByDetectionClassUpdated } from "./generalSettingsSlice"
import { useAppDispatch } from "./store"
import { joinedStringFromDict } from "../lib/util"
import { Picker } from "../lib/Picker"
import { Detection } from "./VideoPlayer"
import * as videoplayercss from "./videoplayer.module.css"
import { HSL, hslEquals, hslToLuminance, hslToString } from "../lib/colour"
import { Icon } from "../lib/Icon"
import { selectHideDetectionBoxes } from "./appSlice"
import { useEffect } from "preact/hooks"
import * as css from "./classsliders.module.css"

export const ClassSliders: FunctionComponent = () => {
  const settingsByDetectionClass = useSelector(selectSettingsByDetectionClass)
  const realOrDefaultSettingsByDetectionClass = useSelector(selectRealOrDefaultSettingsByDetectionClass)
  const detectionInfo = useSelector(selectDetectionInfoPotentiallyNull)
  const isUpToDate = useSelector(selectSettingsByDetectionClassIsForCurrentSettings)
  const confidenceLocation = useSelector(selectConfidenceLocation)
  const hideDetectionBoxes = useSelector(selectHideDetectionBoxes)
  const dispatch = useAppDispatch()
  useEffect(() => {
    if (!isUpToDate && realOrDefaultSettingsByDetectionClass) {
      dispatch(settingsByDetectionClassUpdated(
        Object.fromEntries(realOrDefaultSettingsByDetectionClass.entries())))
    }
  }, [realOrDefaultSettingsByDetectionClass, isUpToDate])

  if (!settingsByDetectionClass) {
    return <div>
      Refreshing.....
    </div>
  }

  if (!detectionInfo) {
    return <div>
      You need to load a detection file for this tab to work.
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
    <Picker onChange={newValue => dispatch(confidenceLocationUpdated(
      newValue as ConfidenceLocation))}
      value={confidenceLocation}
      nrColumns={3}
    >
      {([...["outer-top", "inner-top", "inner-bottom", "outer-bottom"].flatMap(vert => {
        const [io, tb] = vert.split("-");
        return ["left", "center", "right"].map(hori => [io, hori, tb].join("-"))
      }
      ), "off"] as ConfidenceLocation[]).map(
          confidenceLocation =>
            <div data-value={confidenceLocation} title={confidenceLocation}>
              <svg viewBox="0 0 64 64"
                style={{
                "--video-width": "64px",
                "--video-height": "64px",
                }}
                className={joinedStringFromDict({
                  [videoplayercss.overlay]: true,
                  [css.confidence_location_box]: true})}>
                <Detection 
                  alpha={1}
                  detection={{klass: -1, cx: 0.5, cy: 0.5,
                    width: .7, height: .4, confidence: .73}}
                  colour={{h: 0, s: 0, l: 30}}
                  confidenceLocation={confidenceLocation}
                />
              </svg>
              <span className={css.confidence_location_name}>
                {confidenceLocation}
              </span>
            </div>
        )}

    </Picker>
    <table className={css.class_sliders}>
      <thead>
        <tr>
          <th>class</th>
          <th>show</th>
          <th>colour</th>
          <th>cutoff<div className={css.counts}>(shown/total)</div></th>
          <th>alpha</th>
          </tr>
          </thead>
      <tbody>

        {(Object.entries(settingsByDetectionClass) as [keyof typeof settingsByDetectionClass, SettingsForDetectionClass][]).map(
          ([key, value]) => (
            <tr className={joinedStringFromDict({[css.hidden]: value.hide})}>
              <td>{key} -- {value.name}</td>
              <td>
                <span className={css.hidebox} onClick={() => dispatch(hideToggled({klass: key}))}>
                  <Icon iconName={value.hide ? "check_box_outline_blank" : "check_box"} />
                </span>
              </td>
              <td>
                <Picker
                  value={value.colour}
                  equals={hslEquals}
                  onChange={newColour => dispatch(colourUpdated({klass: key, newColour}))}
                  nrColumns={4}
                  >
                  { [0, 60, 120, 180, 240, 300].flatMap(h =>
                      [[25, 100], [50, 50], [50, 100], [75, 50]].map(([l, s]) =>
                        <ColourBox data-value={{h, s, l}} colour={{h, s, l}} />
                    ))}
                </Picker>
              </td>
              <td>
                <input type="range" min={0.10} max={0.95} step={0.05}
                  disabled={value.hide}
                  value={value.confidenceCutoff}
                  onChange={e => dispatch(confidenceCutoffUpdated({
                    klass: key, newConfidenceCutoff:
                    e.currentTarget.valueAsNumber}))}/>
                <span class={css.range_value}>{value.confidenceCutoff.toFixed(2)}</span>
                <span className={css.counts}>({(() => {
                  const counts = shownTotalByClass.get(key)!
                  const strlen = counts.total.toString().length
                  return `${counts.shown.toString().padStart(strlen, "0")}/${counts.total}`

                })()})</span>
              </td>
              <td title={hideDetectionBoxes ? "Detection boxes are hidden" :
                value.hide ? "This class is hidden" :
                  "Make the box more (1) or less (0) visible"} >
                <input type="range" min={0} max={1} step={0.1}
                  disabled={value.hide || hideDetectionBoxes}
                  value={value.alpha}
                  onChange={e => dispatch(alphaUpdated({
                    klass: key,
                    newAlpha: e.currentTarget.valueAsNumber}))}/>
                <span class={css.range_value}>{value.alpha.toFixed(2)}</span>
              </td>

        </tr>
      ))}
      </tbody>
      </table>
  </>
}

const ColourBox: FunctionComponent<{colour: HSL}> = ({colour}) => {
    return <div style={{
              "--class-colour": hslToString(colour),
              "--class-text-colour": hslToLuminance(colour) > .5 ? "black" : "white",
              }} className={css.class_colour_box}>0.73</div>
}
