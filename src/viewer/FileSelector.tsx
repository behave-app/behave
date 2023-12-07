import { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import { useSelector } from 'react-redux';
import { xxh64sum } from "../lib/fileutil.js";
import { RootState, useAppDispatch } from "./store.js";
import { createSelector } from "@reduxjs/toolkit";
import { selectVideoFilePotentiallyNull, VideoFile, videoFileAdded} from "./videoFileSlice.js";

type VideoFileState = {
  state: "none"
} | {
  state: "loading",
  file: File,
  progress: number,
} | (
  {state: "done"} & VideoFile
)

export const FileSelector: FunctionComponent = () => {
  const dispatch = useAppDispatch()
  const [videoFile, setVideoFile] = useState<VideoFileState>(
    useSelector(createSelector(
      selectVideoFilePotentiallyNull,
      vf => {
        if (vf === null) {
          return {state: "none"}
        }
        return {state: "done", ...vf}
      })))

  const chooseVideoFile = async () => {
    let fsfh
    try {
      fsfh = (await window.showOpenFilePicker({
        id: "videofile",
        types: [{
          description: "Video (MTS) file",
          accept: {
            "video/*": ".MTS"
          }}]
      } as OpenFilePickerOptions /* need this because language server doesn't know about "id" option */))[0]
    } catch (e) {
      return
    }
    const file = await fsfh.getFile()
    setVideoFile({
      state: "loading",
      progress: 0,
      file
    })
    const hash = await xxh64sum(
      file,
      progress => setVideoFile(vf => {
        if (vf.state === "loading" && vf.file === file) {
          return {...vf, progress}
        }
        return vf
      })
    )
    setVideoFile(vf => {
      if (vf.state === "loading" && vf.file === file) {
        return {state: "done", file, xxh64sum: hash}
      }
      return vf
    })
  }

  const saveButtonEnabled = videoFile.state === "done"

  const save = () => {
    if (videoFile.state !== "done") {
      throw new Error("Illegal state")
    }
    dispatch(videoFileAdded(
      {file: videoFile.file, xxh64sum: videoFile.xxh64sum}))
  }

  return <dl>
    <dt>Video file</dt>
    <dd>
      {videoFile.state !== "none" && videoFile.file.name}
      <button onClick={chooseVideoFile} disabled={videoFile.state === "loading"}>
        {videoFile.state === "none" ? "Choose"
          : videoFile.state === "loading"
          ? `loading (${(videoFile.progress * 100).toFixed(1)}%)`
          : "Change"}
      </button>
    </dd>
    <button onClick={save} disabled={!saveButtonEnabled}>Save</button>
  </dl>
}

