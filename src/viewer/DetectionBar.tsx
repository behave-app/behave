import { FunctionComponent } from "preact"
import * as css from "./viewer.module.css"
import { detectionsDirectorySet, selectDetectionsDirectory, selectDetectionsDirectoryIsReady } from "./detectionsDirectorySlice"
import { useSelector } from "react-redux"
import { useState } from "react"
import { useAppDispatch } from "./store"
import { ModalPopup } from "src/lib/ModalPopup"

const DetectionBarNoDirectory: FunctionComponent = () => {
  const [moreInfoOpen, setMoreInfoOpen] = useState(false)
  const dispatch = useAppDispatch()

  return <div>
    No detection directory was set.
    <a href="javascript:void(0)" onClick={() => setMoreInfoOpen(true)}>More info...</a>
    <button onClick={() => {
      void((async () => {
      try {
          const directory = await window.showDirectoryPicker({id: "detectionDir"})
          if (directory) {
            dispatch(detectionsDirectorySet({directory}))
          }
        } catch (e) {
          console.error("Picking directory error: ", e)
          }

      })())
    }}>Select detection directory</button>
    {moreInfoOpen && <ModalPopup addOkButtonCallback={() => setMoreInfoOpen(false)}>
      <div>
        The system will automatically scan the chosen directory and all its
        subdirectories for a detection file for the video file that is watched.
        This will work smoothly as long as the number of files in all subdirectories
        is less than a couple of thousand.
      </div>
      <div>
        This webpage will never write to this directory (it will not even have
        permission to write).
      </div>
      </ModalPopup>}
  </div>
}

const DetectionBarWithDirectory: FunctionComponent = () => {
  return <div>We have a dir!</div>
}

export const DetectionBar: FunctionComponent = () => {
  const hasDirectory = useSelector(selectDetectionsDirectoryIsReady)

  return <div className={css.detectionbar}>
    {hasDirectory ? <DetectionBarWithDirectory /> : <DetectionBarNoDirectory />}
  </div>
}
