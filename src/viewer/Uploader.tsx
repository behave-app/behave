import { FunctionComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSelector } from "react-redux";
import { VideoFile, createSliceDataFromFile, selectVideoFilePotentiallyNull, videoFileSet } from "./videoFileSlice";
import { useAppDispatch } from "./store";
import { assert, asyncSleep, binItems, isTruthy, valueOrError, valueOrErrorAsync } from "../lib/util";
import * as css from "./uploader.module.css"
import * as generalcss from "./general.module.css"
import { Icon } from "../lib/Icon";
import { validateDataIsDetectionInfo } from "../lib/detections";
import { detectionFileNameSet, detectionsInfoSet } from "./detectionsSlice";
import { behaviourInfoLinesSet, behaviourInfoUnset, csvToLines, validateDataIsBehaviourLines } from "./behaviourSlice";
import { selectBehaviourLayout } from "./generalSettingsSlice";
import { EXTENSIONS } from "../lib/constants"

type Props = {
  onRequestClose: () => void
}

export const Uploader: FunctionComponent<Props> = ({onRequestClose}) => {
  type DragState = "nodrag" | "dragging"
  const dragCounter = useRef(0)
  const [fileSystemHandles, setFileSystemHandles] = useState<ReadonlyArray<FileSystemHandle >>([])
  const [dragState, setDragState] = useState<DragState>("nodrag")
  const dispatch = useAppDispatch()
  const [error, setError] = useState<string|null>(null)
  const behaviourLayout = useSelector(selectBehaviourLayout)
  const videoFileAlreadyLoaded = useSelector(selectVideoFilePotentiallyNull) !== null
  const [videoFileMap, setVideoFileMap] = useState(new Map<FileSystemHandle, "loading" | VideoFile | Error>())

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
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      await asyncSleep(1000)
    }
    const handlesOrError = await valueOrErrorAsync(window.showOpenFilePicker)({
      id: "selectInputFiles",
      multiple: true,
      types: [
        {description: "behave files", accept: {
          "application/json": [EXTENSIONS.detectionFile],
          "video/mp4": [EXTENSIONS.videoFile],
          "text/csv": [EXTENSIONS.behaviourFile]
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

  const keys = ["video", "detection",  "behaviour",  "other"] as const
  type TypeKey = typeof keys[number]
  const filesByType = binItems<FileSystemHandle, TypeKey>(fileSystemHandles,
    fh => fh.kind === "directory" ? "other"
      : fh.name.toLocaleLowerCase().endsWith(EXTENSIONS.videoFile) ? "video"
        : fh.name.toLocaleLowerCase().endsWith(EXTENSIONS.detectionFile) ? "detection"
          : fh.name.toLocaleLowerCase().endsWith(EXTENSIONS.behaviourFile) ? "behaviour"
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
  const videoFileInfoRaw = videos.length === 1  ? videoFileMap.get(videos[0]) ?? null : null
  const videoFileInfo = (videoFileInfoRaw === "loading" || videoFileInfoRaw instanceof Error) ? null : videoFileInfoRaw
  const matchingHashes = videoFileInfo !== null
    && (detections.length === 1 && videoFileInfo.metadata.hash === extractHashFromFilename(detections[0].name))
    && (behaviours.length === 0 || (
      behaviours.length === 1 && videoFileInfo.metadata.hash === extractHashFromFilename(behaviours[0].name)))

  useEffect(() => {
    if (videos.length !== 1) {
      return
    }
    const video = videos[0]
    if (videoFileMap.has(video)) {
      return
    }
    if (new Set(videoFileMap.values()).has("loading")) {
      return
    }
    setVideoFileMap(videoFileMap =>
      new Map([...videoFileMap.entries(), [video, "loading"]]))
    void((async () => {
      const result = await valueOrErrorAsync(
        createSliceDataFromFile)(await video.getFile())
      if ("error" in result) {
        const error: Error = result.error instanceof Error
          ? result.error : new Error(`${result.error}`)
        setVideoFileMap(videoFileMap =>
          new Map([...videoFileMap.entries(), [video, error]]))
        return
      }
      setVideoFileMap(videoFileMap =>
        new Map([...videoFileMap.entries(), [video, result.value]]))
    })())
  }, [videos, videoFileMap])

  if (fileSystemHandles.length) {
    const selectTheseFiles = async () => {
      assert(correctCounts && matchingHashes)
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
        detectionInfo.sourceFileXxHash64 = videoFileInfo.metadata.hash
      }
      assert(detectionInfo.sourceFileXxHash64 === videoFileInfo.metadata.hash)
      let behaviourLines: null | string[][] = null
      if (behaviourFile) {
        const behaviourCSV = await behaviourFile.text()
        const linesOrError = valueOrError(csvToLines)(behaviourCSV)
        if ("error" in linesOrError || !validateDataIsBehaviourLines(
          linesOrError.value, behaviourLayout)) {
          setError("The behaviour file is corrupted, and cannot be opened")
          return
        }
        behaviourLines = linesOrError.value
      }

      dispatch(videoFileSet(videoFileInfo))
      dispatch(detectionFileNameSet(detectionFile.name))
      dispatch(detectionsInfoSet(detectionInfo))
      if (behaviourLines) {
        dispatch(behaviourInfoLinesSet({
          filename: behaviourFile!.name,
          layout: behaviourLayout,
          lines: behaviourLines
        }))
      } else {
        dispatch(behaviourInfoUnset())
      }
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
      {error !== null && <div className={css.warning}>
        Selecting files failed: {error}</div>
      }
      {!correctCounts
        ? <div className={css.warning}>
          We need one video file (<code>*{EXTENSIONS.videoFile}</code>) and an accompanying
          detection file (<code>*{EXTENSIONS.detectionFile}</code>) to continue.
          In addition a single behaviour file (<code>*{EXTENSIONS.behaviourFile}</code>) may
          be uploaded.
          Please upload more files below (or drag and drop them in),
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
                  {(info => 
                  info === undefined ? null
                    : info === "loading"
                      ? <span><span className={generalcss.spinner}></span></span>
                    : info instanceof Error
                      ? <span className={css.video_error} title={info.message}>video file not valid</span>
                      : <span>hash: {info.metadata.hash}</span>)(videoFileMap.get(fh))}
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
      <hr />
      <div className={generalcss.button_row}>
        <button disabled={!(correctCounts && matchingHashes)}
          onClick={selectTheseFiles}>
          Start
        </button>
        <button disabled={!videoFileAlreadyLoaded} onClick={onRequestClose}>
          Cancel
        </button>
        <button onClick={onSelectFileUpload}>
          Upload more files
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
      Start by dragging in a Video and a Detection file (and possibly a Behave file), or upload files below
    </div>
    <hr />
    <div className={generalcss.button_row}>
      <button disabled>
        Start
      </button>
      <button disabled={!videoFileAlreadyLoaded} onClick={onRequestClose}>
        Cancel
      </button>
      <button onClick={onSelectFileUpload}>
        Upload files
      </button>
    </div>
  </div>
}
