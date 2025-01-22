import { FunctionComponent } from "preact"
import * as css from "./viewer.module.css"
import { selectDetectionInfoPotentiallyNull } from "./detectionsSlice"
import { useSelector } from "react-redux"
import { DetectionBarDetections } from "./DetectionBarDetections"
import { DetectionBarNoDetections } from "./DetectionBarNoDetections"
import { selectVideoFilePotentiallyNull } from "./videoFileSlice"


export const DetectionBar: FunctionComponent = () => {
  const hasDetectionInfo = !!useSelector(selectDetectionInfoPotentiallyNull)
  const hasVideoFile = !!useSelector(selectVideoFilePotentiallyNull)

  return <div className={css.detectionbar}>
    {hasDetectionInfo ? <DetectionBarDetections />
      : hasVideoFile ? <DetectionBarNoDetections />
      : ""}
  </div>
}
