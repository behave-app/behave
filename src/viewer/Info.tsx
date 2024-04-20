import { FunctionComponent } from "preact"
import { useSelector } from "react-redux"
import { selectMetadata, selectVideoFilePotentiallyNull } from "./videoFileSlice"
import { selectCurrentFrameDateTime, selectCurrentFrameNumber, selectDateTimes, selectSettingsByDetectionClassForCurrectDetections } from "./selectors"
import { selectDetectionFilename, selectDetectionInfoPotentiallyNull } from "./detectionsSlice"
import { selectCurrentTime, selectDuration } from "./videoPlayerSlice"
import { ObjectEntries, ObjectKeys, assert, formatTime, getBehaveVersion } from "../lib/util"
import { DateTimeParts, formatDateTimeParts } from "../lib/datetime"
import { hslToString } from "../lib/colour"
import * as css from "./info.module.css"
import { selectBehaviourInfo } from "./behaviourSlice"

function formatInterval(parts1: DateTimeParts, parts2: DateTimeParts): string {
  const formatDate = "%Y-%m-%d"
  const formatTime = "%H:%M:%S"
  const formatDateTime = [formatDate, formatTime].join(" ")
  const format2 = (parts1.year === parts2.year
    && parts1.month === parts2.month
    && parts2.day === parts2.day) ? formatTime : formatDateTime
  return formatDateTimeParts(parts1, formatDateTime) + " - " + formatDateTimeParts(
    parts2, format2)
}

export const Info: FunctionComponent = () => {
  const video = useSelector(selectVideoFilePotentiallyNull)
  const currentTime = useSelector(selectCurrentTime)
  const totalTime = useSelector(selectDuration)
  const currentFrameNumber = useSelector(selectCurrentFrameNumber)
  const detectionInfo = useSelector(selectDetectionInfoPotentiallyNull)
  const detectionFileName = useSelector(selectDetectionFilename)
  const dateTimes = useSelector(selectDateTimes)
  const settingsByDetectionClass = useSelector(selectSettingsByDetectionClassForCurrectDetections)
  const behaviourInfo = useSelector(selectBehaviourInfo)
  const currentDateTime = useSelector(selectCurrentFrameDateTime)
  const metadata = useSelector(selectMetadata)

  const shownTotalByClass = (() => {
    if (!detectionInfo || !settingsByDetectionClass) {
      return null
    }
  const shownTotalByClass = new Map<`${number}`, {shown: number, total: number}>(
        (ObjectKeys(detectionInfo.modelKlasses)).map(
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
    return shownTotalByClass
  })()

  return <>
    <h2>Behave</h2>
    <dl className={css.info_list}>
      <dt>Behave version</dt>
      <dd>{getBehaveVersion()}</dd>
      <dt>Video file</dt>
      <dd>{video?.file.name ?? "No video file loaded"}</dd>
      <dt>Current / total playback time</dt>
      <dd>{currentTime !== null && formatTime(currentTime)} / {
        totalTime !== null && formatTime(totalTime)}</dd>
      <dt>Current / total frame number</dt>
      <dd>{currentFrameNumber} / {metadata && metadata.numberOfFrames}</dd>
      <dt>Real-world start - end time (current time)</dt>
      <dd>{dateTimes && dateTimes.length
        && formatInterval(dateTimes.at(0)!, dateTimes.at(-1)!)}
      {currentDateTime &&
          ` (${formatDateTimeParts(currentDateTime, "%Y-%m-%d %H:%M:%S")})`}</dd>
      <dt>Detection file</dt>
      <dd>{detectionFileName ?? "No detection file loaded"}</dd>
      <dt>Number of detections:</dt>
      <dd>{detectionInfo && shownTotalByClass && settingsByDetectionClass && <ul
        className={css.model_klass_list}>
        {ObjectEntries(detectionInfo.modelKlasses).map(([key, klassName]) => <li>
          <div className={css.colour_block} style={{"--colour":
              hslToString(settingsByDetectionClass.get(key)!.colour)}}
          />
          {klassName}: total <b>{shownTotalByClass.get(key)!.total}</b> (
          <b>{shownTotalByClass.get(key)!.shown}</b> visible at current
          confidence settings) {
            settingsByDetectionClass.get(key)!.hide && "<class is hidden>"}
        </li>)}
      </ul>}</dd>
      <dt>Behaviour file</dt>
      <dd>
        {behaviourInfo?.filename ?? "No behaviour file"}
        {behaviourInfo && behaviourInfo.readonly && " (read only)"}
      </dd>
      <dt>Number of behaviour lines</dt>
      <dd>{behaviourInfo ? behaviourInfo.lines.length - 1 : "-"}</dd>
    </dl>
  </>
}
