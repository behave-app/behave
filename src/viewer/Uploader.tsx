import { FunctionComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSelector } from "react-redux";
import { selectVideoFilePotentiallyNull, videoFileSet } from "./videoFileSlice";
import { useAppDispatch } from "./store";
import { assert, binItems, isTruthy, valueOrError, valueOrErrorAsync } from "../lib/util";
import * as css from "./uploader.module.css"
import * as generalcss from "./general.module.css"
import { Icon } from "../lib/Icon";
import { validateDataIsDetectionInfo } from "../lib/detections";
import { detectionsInfoSet } from "./detectionsSlice";

type Props = {
  onRequestClose: () => void
}

export const Uploader: FunctionComponent<Props> = ({onRequestClose}) => {
  type DragState = "nodrag" | "dragging"
  const dragCounter = useRef(0)
  const [fileSystemHandles, setFileSystemHandles] = useState<ReadonlyArray<FileSystemHandle >>([])
  const [dragState, setDragState] = useState<DragState>("nodrag")
  const dispatch = useAppDispatch()
  const [error, setError] = useState<string|null>()

  useEffect(() => {
    const aimedAt = window.document.documentElement
    const dragEnter = (_event: DragEvent) => {
      dragCounter.current += 1
      setDragState("dragging")
    }
    const dragDrop = async (event: DragEvent) => {
      dragCounter.current -= 1
      event.preventDefault()
      setDragState("nodrag")
      setError(null)

      if (event.dataTransfer === null || event.dataTransfer.items.length === 0) {
        setError("Make sure you drag a file")
        return
      }

      const newHandles = (await Promise.all([...event.dataTransfer.items].map(item => item.getAsFileSystemHandle()))).filter(isTruthy)
      setFileSystemHandles(handles => [...handles, ...newHandles])
    }

    const dragLeave = (_event: DragEvent) => {
      dragCounter.current -= 1
      if (dragCounter.current > 0) {
        return;
      }
      setDragState("nodrag")
    }
    const dragOver = (event: DragEvent) => {
      event.preventDefault()
    }
    aimedAt.addEventListener("dragenter", dragEnter)
    aimedAt.addEventListener("dragleave", dragLeave)
    aimedAt.addEventListener("dragover", dragOver)
    aimedAt.addEventListener("drop", dragDrop)
    return () => {
      aimedAt.removeEventListener("dragenter", dragEnter)
      aimedAt.removeEventListener("dragleave", dragLeave)
      aimedAt.removeEventListener("dragover", dragOver)
      aimedAt.removeEventListener("drop", dragDrop)
    }
  }, [])

  const onSelectFileUpload = async () => {
    const handlesOrError = await valueOrErrorAsync(window.showOpenFilePicker)({
      id: "selectInputFiles",
      multiple: true,
      types: [
        {description: "behave files", accept: {
          "application/json": [".behave.det.json"],
          "video/mp4": [".behave.mp4"],
          "text/csv": [".behave.csv"]
        }}]
    })
    if ("error" in handlesOrError) {
      const {error} = handlesOrError
      if (error instanceof DOMException){
        console.log("Getting files interrupted")
      }
      else {
        throw error
      }
    } else {
      setFileSystemHandles(handles => [...handles, ...handlesOrError.value])
    }
  }

  if (dragState === "dragging") {
    return <div className={css.uploader}>
      <div>
        Drop your files here
      </div>
    </div>
  }

  if (fileSystemHandles.length) {
    const keys = ["video", "detection",  "behaviour",  "other"] as const
    type TypeKey = typeof keys[number]
    const filesByType = binItems<FileSystemHandle, TypeKey>(fileSystemHandles,
      fh => fh.kind === "directory" ? "other"
      : fh.name.toLocaleLowerCase().endsWith(".behave.mp4") ? "video"
      : fh.name.toLocaleLowerCase().endsWith(".behave.det.json") ? "detection"
      : fh.name.toLocaleLowerCase().endsWith(".behave.csv") ? "behaviour"
      : "other")
    const videos = (filesByType.get("video") ?? []) as FileSystemFileHandle[]
    const detections = (filesByType.get("detection") ?? []) as FileSystemFileHandle[]
    const behaviours = (filesByType.get("behaviour") ?? []) as FileSystemFileHandle[]
    const correctCounts = videos.length === 1 && detections.length === 1
      && behaviours.length < 2
    const extractHashFromFilename = (filename: string): string | symbol  => {
      const parts = filename.split(".")
      const behave = parts.lastIndexOf("behave")
      if (behave === -1 || behave === 0) {
        return Symbol("no hash")
      }
      const hash = parts[behave - 1]
      if (!/^[0-9a-fA-F]{8,16}$/.test(hash)) {
        return Symbol("no hash")
      }
      return hash
    }
    const videoHash = videos.length === 1
    ? extractHashFromFilename(videos[0].name) : null
    const matchingHashes = videoHash !== null
      && (detections.length === 1 && videoHash === extractHashFromFilename(detections[0].name))
      && (behaviours.length === 0 || (
      behaviours.length === 1 && videoHash === extractHashFromFilename(behaviours[0].name)))

    const selectTheseFiles = async () => {
      assert(correctCounts && matchingHashes && typeof videoHash === "string")
      const videoFile = await videos[0].getFile()
      const detectionFile = await detections[0].getFile()
      const behaviourFile = await behaviours.at(0)?.getFile()
      const detectionText = await detectionFile.text()
      const detectionInfoOrError = valueOrError(JSON.parse)(detectionText)
      if ("error" in detectionInfoOrError) {
        setError("The detection file is corrupted, and cannot be opened")
        return
      }
      const detectionInfo = detectionInfoOrError.value
      if (!validateDataIsDetectionInfo(detectionInfo)) {
        setError("The detection file is corrupted, and cannot be opened")
        return
      }
      if (detectionInfo.sourceFileXxHash64 === "See filename") {
        detectionInfo.sourceFileXxHash64 = videoHash
      }
      assert(detectionInfo.sourceFileXxHash64 === videoHash)
      if (behaviourFile) {
        // TODO validate behaviours
      }
      dispatch(videoFileSet({file: videoFile, xxh64sum: videoHash}))
      dispatch(detectionsInfoSet(detectionInfo))
      onRequestClose()
    }

    const messageByType: {[k in TypeKey]: string} = {
      video: "exactly one needed",
      detection: "exactly one needed",
      behaviour: "zero or one needed",
      other: "will be ignored",
    }

    return <div className={css.uploader}>
      <h2>Welcome to Behave</h2>
      {!correctCounts
        ? <div className={css.warning}>
          We need one video file (<code>*.behave.mp4</code>) and an accompanying
          detection file (<code>*.behave.det.json</code>) to continue.
          In addition a single behaviour file (<code>*.behave.csv</code>) may
          be uploaded.
          Please <button onClick={onSelectFileUpload}>
            upload more files here</button> (or drag and drop them in),
          or remove any excess files below.
          You can always reload this page to start again.
        </div>
        : !matchingHashes
          ?<div className={css.warning}>
            The selected files seem to be not for the same video file.
            Each file that is used in behave, has a 16 character code that comes
            just before the extension, that uniquely points to the source video
            file that was used to generate this file.
          </div>
          :<div>Press the submit button below to continue with these files</div>
      }
      <dl>
        {keys.map(key => <>
          <dt>
            {key[0].toUpperCase() + key.slice(1)}s files ({messageByType[key]})
          </dt>
          <dd>
            <ul className={css.file_list}>
              {(filesByType.get(key) ?? []).map(
                fh => <li className={generalcss.show_on_hover_buttons}>
                  <span>{fh.name}</span>
                  <button className={generalcss.show_on_hover}
                    onClick={() => setFileSystemHandles(fhs => fhs.filter(
                      filterFh => filterFh !== fh))}>
                    <Icon iconName="delete" />
                  </button>
                </li>)}
            </ul>
          </dd>
        </>
        )}
      </dl>
      <div className={generalcss.button_row}>
        <button disabled={!(correctCounts && matchingHashes)}
          onClick={selectTheseFiles}>
          Submit
        </button>
      </div>
    </div>
  }

  return <div className={css.uploader}>
    <h2>Welcome to Behave</h2>
    <div>
      This app lets you generate csv (Excel) files from Videos and Detection files. TODO: enhance explanation, add link.
    </div>
    <div>
      Start by dragging in a Video and a Detection file (and possibly a Behave file), or <button onClick={onSelectFileUpload}>select them here</button>
    </div>
  </div>
}
