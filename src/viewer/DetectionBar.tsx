import { FunctionComponent } from "preact"
import * as css from "./viewer.module.css"
import { detectionsDirectorySet, selectDetectionsDirectory, selectDetectionsDirectoryIsReady, DetectionsDirectory, detectionsInfoSet, selectDetectionInfo } from "./detectionsSlice"
import { useSelector } from "react-redux"
import { useEffect, useState } from "react"
import { useAppDispatch } from "./store"
import { ModalPopup } from "src/lib/ModalPopup"
import { selectVideoFilePotentiallyNull } from "./videoFileSlice"
import { detectionInfoFromFile, DetectionInfo } from "./detections"
import { selectCurrentFrameNumber, selectPlaybackControls } from "./videoPlayerSlice"
import { DetectionBarDetections } from "./DetectionBarDetections"

const DetectionBarNoDirectory: FunctionComponent = () => {
  const [filesSeenWhileLoading, setFilesSeenWhileLoading] = useState<number | null>(null)
  const [moreInfoOpen, setMoreInfoOpen] = useState(false)
  const dispatch = useAppDispatch()

  async function scanDirectoryAndSave(directory: FileSystemDirectoryHandle) {
    const directoriesToCheck = [directory]
    const detectionsByFilename: DetectionsDirectory["detectionsByFilename"] = {}
    let filesSeen = 0
    while (directoriesToCheck.length > 0) {
      const currentDirectory = directoriesToCheck.pop()!
      for await (const [name, fileOrDirHandle] of currentDirectory.entries()) {
        if ((filesSeen++ % 100) === 0) {
          setFilesSeenWhileLoading(filesSeen)
        }
        if (fileOrDirHandle instanceof FileSystemDirectoryHandle) {
          directoriesToCheck.push(fileOrDirHandle)
        } else {
          if (!(name in detectionsByFilename)) {
            detectionsByFilename[name] = []
          }
          detectionsByFilename[name].push(fileOrDirHandle)
        }
      }
    }
    dispatch(detectionsDirectorySet({directory, detectionsByFilename}))
  }

  return <div>
    {filesSeenWhileLoading !== null && <ModalPopup>
      <>Scanning directory, looked at {filesSeenWhileLoading} files.</>
    </ModalPopup>}
    No detection directory was set.
    <a href="javascript:void(0)" onClick={() => setMoreInfoOpen(true)}>More info...</a>
    <button onClick={() => {
      void((async () => {
      try {
          const directory = await window.showDirectoryPicker({id: "detectionDir"})
          if (directory) {
            void(scanDirectoryAndSave(directory))
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

type DetectionState = "no video" | "searching" | "no detection file found"

const DetectionBarWithDirectory: FunctionComponent = () => {
  const [detectionState, setDetectionState] = useState<DetectionState>("no video")
  const detectionsDirectory = useSelector(selectDetectionsDirectory)
  const videoFile = useSelector(selectVideoFilePotentiallyNull)
  const dispatch = useAppDispatch()

  useEffect(() => {
    void((async () => {
      if (!videoFile) {
        setDetectionState("no video")
        return
      }
      setDetectionState("searching")
      const baseFilename = videoFile.file.name.split(".").slice(0, -1).join(".")
      const detectionsFilename = baseFilename + ".csv"
      const possibleDetectionFileHandles =
      detectionsDirectory.detectionsByFilename[detectionsFilename] ?? []
      for (const fileHandle of possibleDetectionFileHandles) {
        const detectionInfo = await detectionInfoFromFile(
          await fileHandle.getFile())
        if (detectionInfo !== null) {
          dispatch(detectionsInfoSet(detectionInfo))
          return
        }
      }
      setDetectionState("no detection file found")
    })())
  }, [detectionsDirectory, videoFile])

  switch (detectionState) {
    case "no video":
      return <div>Waiting for a video file to be loaded</div>
    case "searching":
      return <div>Searching for a matching detection file</div>
    case "no detection file found":
      return <div>No detection file was found for this video</div>
    default: {
      const exhaustive: never = detectionState
      throw new Error(`Unhandled detection state: ${exhaustive}`)
    }
  }
}

export const DetectionBar: FunctionComponent = () => {
  const hasDetectionInfo = !!useSelector(selectDetectionInfo)
  const hasDirectory = useSelector(selectDetectionsDirectoryIsReady)

  return <div className={css.detectionbar}>
    {hasDetectionInfo ? <DetectionBarDetections />
    : hasDirectory ? <DetectionBarWithDirectory />
    : <DetectionBarNoDirectory />}
  </div>
}
