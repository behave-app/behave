import { FunctionComponent } from "react"
import { useSelector } from "react-redux"
import { selectDetectionInfoPotentiallyNull } from "./detectionsSlice"
import { ConfidenceLocation, alphaUpdated, colourUpdated, confidenceCutoffUpdated, confidenceLocationUpdated, getKeyFromModelKlasses, hideToggled, selectConfidenceLocation, selectSettingsByDetectionClassByKey, selectTimeOffsetSeconds, settingsByDetectionClassUpdated, timeOffsetSecondsSet } from "./generalSettingsSlice"
import { useAppDispatch } from "./store"
import { assert, joinedStringFromDict } from "../lib/util"
import { Picker } from "../lib/Picker"
import { Detection } from "./VideoPlayer"
import * as videoplayercss from "./videoplayer.module.css"
import * as generalcss from "../lib/general.module.css"
import { HSL, hslEquals, hslToLuminance, hslToString } from "../lib/colour"
import { Icon } from "../lib/Icon"
import { selectHideDetectionBoxes } from "./appSlice"
import { useEffect } from "preact/hooks"
import * as css from "./classsliders.module.css"
import { selectCurrentFrameDateTime, selectSettingsByDetectionClassForCurrectDetections } from "./selectors"
import { formatDateTimeParts } from "../lib/datetime"

type Props = {
  onRequestClose: () => void
}

export const ClassSliders: FunctionComponent<Props> = ({onRequestClose}) => {
  const settingsByDetectionClassByKey = useSelector(selectSettingsByDetectionClassByKey)
  const settingsByDetectionClass = useSelector(selectSettingsByDetectionClassForCurrectDetections)
  const detectionInfo = useSelector(selectDetectionInfoPotentiallyNull)
  const confidenceLocation = useSelector(selectConfidenceLocation)
  const hideDetectionBoxes = useSelector(selectHideDetectionBoxes)
  const timeOffsetSeconds = useSelector(selectTimeOffsetSeconds)
  const currentFrameDateTime = useSelector(selectCurrentFrameDateTime)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (detectionInfo === null || !settingsByDetectionClass) {
      return
    }
    const key = getKeyFromModelKlasses(detectionInfo.modelKlasses)
    if (!(key in settingsByDetectionClassByKey)) {
      dispatch(settingsByDetectionClassUpdated({
        modelKlasses: detectionInfo.modelKlasses,
        settingsByDetectionClass: Object.fromEntries(
          settingsByDetectionClass.entries())}))
    }
  }, [detectionInfo, settingsByDetectionClass])

  if (!detectionInfo || !settingsByDetectionClass) {
    return <div>
      This window can only be opened if both a video file and a detection file
      are loaded. 
    </div>
  }

  const shownTotalByClass = new Map<`${number}`, {shown: number, total: number}>(
        (Object.keys(detectionInfo.modelKlasses) as Array<`${number}`>).map(
          key => [key, {shown: 0, total: 0}])) 

  detectionInfo.framesInfo.forEach(fi => {
    fi?.detections.forEach(d => {
    const key = `${d.klass}` as const
      const item = shownTotalByClass.get(key)
      const settings = settingsByDetectionClass.get(key)
      assert(item && settings)
      item.total += 1
      if (!settings.hide && d.confidence >= settings.confidenceCutoff) {
        item.shown += 1
      }
    })
  })

  return <div className={css.class_sliders_dialog}>
    <h2>Quick settings</h2>
    <h3>Time offset seconds</h3>
    <div>
      The timestamps on the video files may not line up completely with the
      timestamps that one wishes to use in the Behaviour csv file. If so, it's
      possible to make a small adjustment here. Usually this will be &plusmn;1 or
      &plusmn;2 seconds, however nothing is stopping you to use e.g. 3602 seconds if
      there was a problem with timezones.
    </div>
    <input type="number" value={timeOffsetSeconds} onChange={
      e => dispatch(timeOffsetSecondsSet(e.currentTarget.valueAsNumber))} />
    {currentFrameDateTime && <div>This makes timestamp of current frame: <b>
      {formatDateTimeParts(currentFrameDateTime, "%Y-%m-%d %H:%M:%S")}
    </b></div>}
    <h3>Confidence location</h3>
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
    <h3>Settings per class</h3>
    <div>
      Please note that these settings are stored separately for each list of
      classes.
      You only see the settings here that match the classes used in the current
      detection file.
      So if you set the settings below to something for when you have 2 classes
      ("Cat" and "Dog"), and then you load a detection file with three classes
      ("Cat", "Dog" and "Mouse"), you will see the default settings again.
      Your settings are saved however, for the next time ("Cat" and "Dog") is
      loaded.
    </div>
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

        {[...settingsByDetectionClass.entries()].map(
          ([key, value]) => {
            const base = {modelKlasses: detectionInfo.modelKlasses}
            return <tr className={joinedStringFromDict({[css.hidden]: value.hide})}>
              <td>{key} -- {value.name}</td>
              <td>
                <span className={css.hidebox}
                  onClick={() => dispatch(hideToggled({...base, klass: key}))}>
                  <Icon iconName={value.hide
                    ? "check_box_outline_blank" : "check_box"} />
                </span>
              </td>
              <td>
                <Picker
                  value={value.colour}
                  equals={hslEquals}
                  onChange={newColour => dispatch(colourUpdated({
                    ...base, klass: key, newColour}))} nrColumns={4} >
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
                    ...base,
                    klass: key, newConfidenceCutoff:
                    e.currentTarget.valueAsNumber}))}/>
                <span class={css.range_value}>
                  {value.confidenceCutoff.toFixed(2)}
                </span>
                <span className={css.counts}>({(() => {
                  const counts = shownTotalByClass.get(key)!
                  const strlen = counts.total.toString().length
                  return `${counts.shown.toString().padStart(strlen, "0")}`
                    + `/${counts.total}`

                })()})</span>
              </td>
              <td title={hideDetectionBoxes ? "Detection boxes are hidden" :
                value.hide ? "This class is hidden" :
                  "Make the box more (1) or less (0) visible"} >
                <input type="range" min={0} max={1} step={0.1}
                  disabled={value.hide || hideDetectionBoxes}
                  value={value.alpha}
                  onChange={e => dispatch(alphaUpdated({
                    ...base,
                    klass: key,
                    newAlpha: e.currentTarget.valueAsNumber}))}/>
                <span class={css.range_value}>{value.alpha.toFixed(2)}</span>
              </td>

            </tr>
          })}
      </tbody>
    </table>
    <hr />
    <div className={generalcss.button_row}>
      <button onClick={onRequestClose}>Close</button>
    </div>
  </div>
}

const ColourBox: FunctionComponent<{colour: HSL}> = ({colour}) => {
    return <div style={{
              "--class-colour": hslToString(colour),
              "--class-text-colour": hslToLuminance(colour) > .5 ? "black" : "white",
              }} className={css.class_colour_box}>0.73</div>
}
