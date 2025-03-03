import { FunctionComponent } from "preact";
import { useEffect, useRef, useState, useCallback } from "preact/hooks";
import { useSelector } from "react-redux";
import { VideoFile, createSliceDataFromFile, selectVideoFilePotentiallyNull, videoFileSet } from "./videoFileSlice";
import { useAppDispatch } from "./store";
import { asyncSleep, isTruthy, valueOrError, valueOrErrorAsync, getBehaveVersion, TSAssertType } from "../lib/util";
import * as css from "./uploader.module.css"
import * as generalcss from "../lib/general.module.css"
import { DetectionInfo, validateDataIsDetectionInfo } from "../lib/detections";
import { detectionFileNameSet, detectionsInfoSet, detectionsInfoUnset, selectDetectionFilename } from "./detectionsSlice";
import { behaviourInfoLinesSet, behaviourInfoUnset, csvToLines, selectBehaviourInfo, validateDataIsBehaviourLines } from "./behaviourSlice";
import { selectBehaviourLayout } from "./generalSettingsSlice";
import { extractHashFromFilename } from "../lib/fileutil";

type Props = {
  onRequestClose: () => void
}

export const Uploader: FunctionComponent<Props> = ({onRequestClose}) => {
  type DragState = "nodrag" | "dragging"
  const dragCounter = useRef(0)
  const [dragState, setDragState] = useState<DragState>("nodrag")
  const dispatch = useAppDispatch()
  type Questions = {
    questions: string[],
    videoFile: VideoFile | null,
    detection: {
      filename: string,
      info: DetectionInfo
    }| null,
    behaviour: {
      filename: string,
      lines: string[][],
    } | null,
  }
  const [questions, setQuestions] = useState<Questions | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const behaviourLayout = useSelector(selectBehaviourLayout)
  const videoFile = useSelector(selectVideoFilePotentiallyNull)
  const detectionFileName = useSelector(selectDetectionFilename)
  const behaviourFileName = useSelector(selectBehaviourInfo)?.filename ?? null
  const [newFiles, setNewFiles] = useState<{video: File|null, detection: File|null, behaviour: File|null}|null>(null)

  const handleNewFiles = useCallback(async (fileSystemHandles: FileSystemHandle[], type: "video" | "detection" | "behaviour" | "all") => {
    if (fileSystemHandles.length === 0) {
      return
    }

    let newVideoFile: File|null = null
    let newDetectionFile: File|null = null
    let newBehaviourFile: File|null = null
    const errors: string[] = []

    for (const handle of fileSystemHandles) {
      if (handle.kind === "directory") {
        errors.push("Please add only files")
        continue
      }
      TSAssertType<FileSystemFileHandle>(handle)
      const extension = handle.name.toLowerCase().split(".").at(-1)!
      switch (extension) {
        case "mp4":
          if (newVideoFile !== null) {
            errors.push("Only open a single video file")
          } else if (type === "video" || type === "all") {
            newVideoFile = await handle.getFile()
          } else {
            errors.push(`You cannot open a file of type ${extension}`)
          }
          break;
        case "json":
          if (newDetectionFile !== null) {
            errors.push("Only open a single detection file")
          } else if (type === "detection" || type === "all") {
            newDetectionFile = await handle.getFile()
            if (newDetectionFile.size === 0) {
              errors.push("The detection is empty. Possibly the detection / inference "
                + "terminated / crashed before it was complete")
            }
          } else {
            errors.push(`You cannot open a file of type ${extension}`)
          }
          break;
        case "csv":
          if (newBehaviourFile !== null) {
            errors.push("Only open a single behaviour file")
          } else if (type === "behaviour" || type === "all") {
            newBehaviourFile = await handle.getFile()
          } else {
            errors.push(`You cannot open a file of type ${extension}`)
          }
          break;
        default:
          errors.push(`You cannot open a file of type ${extension}`)
          break;
      }
    }

    if (!videoFile && !newVideoFile) {
      if (newDetectionFile) {
        errors.push("Cannot open a detection file without first opening a video file")
      }
      if (newBehaviourFile) {
        errors.push("Cannot open a behaviour file without first opening a video file")
      }
    }

    if (errors.length > 0) {
      setErrors(errors)
      return
    }

    setNewFiles({video: newVideoFile, detection: newDetectionFile, behaviour: newBehaviourFile})
  }, [videoFile])

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

      if (event.dataTransfer === null || event.dataTransfer.items.length === 0) {
        setErrors(["Make sure you drag a file"])
        return
      }

      setErrors([])
      setQuestions(null)
      await handleNewFiles((await Promise.all([...event.dataTransfer.items].map(item=>item.getAsFileSystemHandle()))).filter(isTruthy), "all")
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
  }, [handleNewFiles])

  const onSelectFileUpload = async (type: "video" | "detection" | "behaviour" | "all") => {
    if (document.fullscreenElement) {
      console.warn("Leaving fullscreen since opening selectFile while full screen leads to a crash")
      await document.exitFullscreen()
      await asyncSleep(1000)
    }
    const accept: Record<`${string}/${string}`, `.${string}` | `.${string}`[]> = {}
    if (type === "video" || type === "all") {
      accept["video/mp4"] = [".mp4"]
    }
    if (type === "detection" || type === "all") {
      accept["application/json"] = [".json"]
    }
    if (type === "behaviour" || type === "all") {
      accept["text/csv"] = [".csv"]
    }

    const handlesOrError = await valueOrErrorAsync(window.showOpenFilePicker)({
      id: `selectInputFiles_${type}`,
      multiple: type === "all",
      types: [
        {description: "behave files", accept}]
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
      await handleNewFiles(handlesOrError.value, type)
    }
  }

  if (dragState === "dragging") {
    return <div className={css.uploader}>
      <div>
        Drop your files here
      </div>
    </div>
  }

  if (errors.length) {
    return <div className={css.uploader}>
      <h2>Error</h2>
      <div>
        {errors.length === 1 ? "An error" : "Several errors"} occured:
      </div>
      <ul>
        {errors.map(error => <li>{error}</li>)}
      </ul>
      <div className={generalcss.button_row}>
        <button onClick={() => setErrors([])}>close</button>
      </div>
    </div>
  }

  const openFiles = (questions: Questions) => {
    if (questions.videoFile) {
      dispatch(videoFileSet(questions.videoFile))
      if (!questions.detection) {
        dispatch(detectionFileNameSet(null))
        dispatch(detectionsInfoUnset())
      }
      if (!questions.behaviour) {
        dispatch(behaviourInfoUnset())
      }
    }
    if (questions.detection) {
      dispatch(detectionFileNameSet(questions.detection.filename))
      dispatch(detectionsInfoSet(questions.detection.info))
    }
    if (questions.behaviour) {
      dispatch(behaviourInfoLinesSet({
        filename: questions.behaviour.filename,
        layout: behaviourLayout,
        lines: questions.behaviour.lines
      }))
    }
  }

  if (questions) {
    return <div className={css.uploader}>
      <h2>Please check the following information</h2>
      <div>
        {questions.questions.length === 1 ? "A potential issue has" : "Several potentia issues have"} popped up with the provided data.
        You may still move forward if you are sure you wan to continue.
      </div>
      <ul>
        {questions.questions.map(question => <li>{question}</li>)}
      </ul>
      <div className={generalcss.button_row}>
        <button onClick={() => setQuestions(null)}>cancel</button>
        <button onClick={() => {
          openFiles(questions)
          setQuestions(null)
        }}>proceed</button>
      </div>
    </div>
  }

  useEffect(() => {
    void((async () => {
      if (newFiles === null
        || (newFiles.video === null &&  newFiles.detection === null
          && newFiles.behaviour === null)) {
        return
      }
      const errors: string[] = []
      const questions: string[] = []
      let sliceData: (VideoFile | null) = null
      if (newFiles.video) {
        try {
          sliceData = await createSliceDataFromFile(newFiles.video)
        } catch (e) {
          errors.push("There was a problem opening the video file.")
          console.error(e)
        }
      }
      let detectionInfo = null
      let behaviourLines: null | string[][] = null
      if (!errors.length) {
        const metadata = sliceData ? sliceData.metadata : videoFile?.metadata
        if (!metadata) {
          throw new Error("Either newFiles.video should be set or a video should have been loaded before.")
        }
        if (newFiles.detection) {
          const detectionText = await newFiles.detection.text()
          const detectionInfoOrError = valueOrError(JSON.parse)(detectionText)
          if ("error" in detectionInfoOrError) {
            errors.push("The detection file is corrupted, and cannot be opened")
          } else {
            detectionInfo = detectionInfoOrError.value
            if (!validateDataIsDetectionInfo(detectionInfo)) {
              errors.push("The detection file is corrupted, and cannot be opened")
            } else {
              if (detectionInfo.sourceFileXxHash64 !== metadata.hash) {
                questions.push("The detection file seems to have been made for a different video file, continue anyways?")
              }
            }
          }
        }
        TSAssertType<DetectionInfo | null>(detectionInfo)
        if (newFiles.behaviour) {
          const behaviourCSV = await newFiles.behaviour.text()
          const linesOrError = valueOrError(csvToLines)(behaviourCSV)
          if ("error" in linesOrError || !validateDataIsBehaviourLines(
            linesOrError.value, behaviourLayout)) {
            errors.push("The behaviour file is corrupted, and cannot be opened")
          } else {
            const behaviourHash = extractHashFromFilename(newFiles.behaviour.name)
            if (behaviourHash !== null && behaviourHash !== metadata.hash) {
              questions.push("The behaviour file seems to have been made for a different video file, continue anyways?")
            }
            behaviourLines = linesOrError.value
          }
        }
      }
      if (errors.length) {
        setErrors(errors)
        setNewFiles(null)
        return
      }
      const potentialQuestions: Questions = {
        questions,
        videoFile: sliceData,
        detection: newFiles.detection ? {
          filename: newFiles.detection.name,
          info: detectionInfo!,
        } : null,
        behaviour: newFiles.behaviour ? {
          filename: newFiles.behaviour.name,
          lines: behaviourLines!
        } : null
      }
      if (questions.length === 0) {
        openFiles(potentialQuestions)
      } else {
        setQuestions(potentialQuestions)
      }
      setNewFiles(null)
    }
    )())
  }, [newFiles])

  if (newFiles) {
    return <div className={css.uploader}>
      <h2>Opening and inspecting files</h2>
      <div>
        Please wait a moment... <span className={generalcss.spinner}></span>
      </div>
    </div>
  }

  return <div className={css.uploader}>
    <h2>Welcome to Behave <span class={generalcss.header_version}>{getBehaveVersion()}</span></h2>
    <div>
      In order to get started, you need to open a video file (either through the "Open video file" buttton below, or by dragging in a video file). In addition, you can add a detection file, and a behaviour file.
    </div>
    <hr />

    <h3>Video file</h3>
    <div>{videoFile ? <>{videoFile.file.name} <span>hash: {videoFile.metadata.hash}</span></> : "<no video file>"}</div>
    <div className={generalcss.button_row_left}>
      <button onClick={() => onSelectFileUpload("video")}>
        Open video file
      </button>
    </div>
    <hr />

    <h3>Detection file</h3>
    <div>{detectionFileName !== null ? detectionFileName : "<no detection file>"}</div>
    <div className={generalcss.button_row_left}>
      <button onClick={() => onSelectFileUpload("detection")}>
        Open detection file
      </button>
      <button disabled={detectionFileName === null} onClick={() => {
        dispatch(detectionsInfoUnset());
        dispatch(detectionFileNameSet(null));
      }}>
        Close detection file
      </button>
    </div>
    <hr />

    <h3>Behaviour file</h3>
    <div>Note: this is only if you want to open an exsiting behaviour file to view or edit. If you want to create a new behaviour file, you must do so in the main interface.
    </div>
    <div>{behaviourFileName !== null ? behaviourFileName : "<no behaviour file>"}</div>
    <div className={generalcss.button_row_left}>
      <button onClick={() => onSelectFileUpload("behaviour")}>
        Open behaviour file
      </button>
      <button disabled={behaviourFileName === null} onClick={() => {
        dispatch(behaviourInfoUnset());
      }}>
        Close behaviour file
      </button>
    </div>
    <hr />
    
    <div className={generalcss.button_row}>
      <button disabled={!videoFile} onClick={onRequestClose}>
        Start behaviour coding
      </button>
    </div>
  </div>
}
