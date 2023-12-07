import { createSelector } from "@reduxjs/toolkit";
import { FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useSelector } from 'react-redux';
import { cp, xxh64sum } from "../lib/fileutil.js";
import { useAppDispatch } from "./store.js";
import { selectOpfsFileCache } from "./appSlice.js";
import { VideoFile, selectVideoFilePotentiallyNull, videoFileAdded } from "./videoFileSlice.js";

type VideoFileState = {
  state: "none"
} | {
  state: "loading",
  file: File,
  progress: number,
} | (
  {state: "done"} & VideoFile
)

type FileSelector = FunctionComponent<{
}>

const OPFS_VIDEO_FILE_NAME = "video.MTS"
const OPFS_VIDEO_FILE_HASH_NAME = "video.xxh64sum"

export const FileSelector: FileSelector = () => {
  const dispatch = useAppDispatch()
  const doUOPFSFileCache = useSelector(selectOpfsFileCache)
  const [videoFile, setVideoFile] = useState<VideoFileState>(
    useSelector(createSelector(
      selectVideoFilePotentiallyNull,
      vf => {
        if (vf === null) {
          return {state: "none"}
        }
        return {state: "done", ...vf}
      })))

  useEffect(function loadVideoFileFromOPFS() {
    if (videoFile.state !== "none" || !doUOPFSFileCache) {
      return
    }
    ;(async () => {
      const opfsRoot = await navigator.storage.getDirectory()
      let fsfh;
      let fsfh_hash;
      try {
        fsfh = await opfsRoot.getFileHandle(OPFS_VIDEO_FILE_NAME)
        fsfh_hash = await opfsRoot.getFileHandle(OPFS_VIDEO_FILE_HASH_NAME)
      } catch {
        console.log("No video file found in cache")
        return
      }
      const hash = await (await fsfh_hash.getFile()).text()
      dispatch(videoFileAdded({
        file: await fsfh.getFile(),
        xxh64sum: hash,
      }))
    })()
  }, [videoFile, doUOPFSFileCache])

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
    const hash = await createAndSetVideoFile(file)
    if (doUOPFSFileCache) {
      console.log("copying file to OPFS")
      const start = Date.now()
      const opfsRoot = await navigator.storage.getDirectory()
      const destination = await opfsRoot.getFileHandle(
        OPFS_VIDEO_FILE_NAME, {create: true})
      cp(file, destination)
      const destination_hash = await opfsRoot.getFileHandle(
        OPFS_VIDEO_FILE_HASH_NAME, {create: true})
      const stream = await destination_hash.createWritable()
      stream.write(new TextEncoder().encode(hash))
      stream.close()
      const end = Date.now()
      console.log(
        `done copying file to OPFS, took ${(end - start) / 1000} seconds, `
        + `${(file.size / (end - start) * 1000 / 1024 / 1024).toFixed(1)} MB/s`
      )
    }
  }

  const createAndSetVideoFile = async (file: File): Promise<string> => {
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
    return hash
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

