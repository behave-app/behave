import { FunctionComponent } from "preact"
import * as css from "./viewer.module.css"
import { selectDetectionInfoPotentiallyNull } from "./detectionsSlice"
import { useSelector } from "react-redux"
import { DetectionBarDetections } from "./DetectionBarDetections"


export const DetectionBar: FunctionComponent = () => {
  const hasDetectionInfo = !!useSelector(selectDetectionInfoPotentiallyNull)

  return <div className={css.detectionbar}>
    {hasDetectionInfo ? <DetectionBarDetections />
    : <div>No detections</div>}
  </div>
}
