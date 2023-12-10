import {Upload} from "../lib/Upload.js"
import {FileTree, FileTreeLeaf, FileTreeBranch, readFileSystemHandle, findLeaf, updateLeaf, getAllLeafPaths} from "../lib/FileTree.js"
import * as css from "./debugger.module.css"
import { JSX } from "preact"
import {useRef, useEffect, useState} from 'preact/hooks'
import { Video } from "../lib/video";

function fileFilter(file: File, extension: string): boolean {
  return !file.name.startsWith(".") && file.name.endsWith("." + extension)
}

export function Debugger(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const skipRef = useRef<number>(0)

  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const newFiles = await readFileSystemHandle(fileSystemHandles, file => fileFilter(file, "mp4"))

    // only set files if none there
    setFiles(files => files.size ? files : newFiles)
  }

  useEffect(() => {
    void((async () => {
      if (files.size === 0) {
        return
      }
      const paths = getAllLeafPaths(files)
      for (const path of paths) {
        const leaf = findLeaf(files, path)
        const start = Date.now()
        await debugRun(leaf.file,  (progress: FileTreeLeaf["progress"]) => {
          const timeLapsed = (Date.now() - start) / 1000
          const newProgress: FileTreeLeaf["progress"] = (typeof progress === "object" &&"converting" in progress) ? {
            timing: {passed: timeLapsed, expected: timeLapsed / (progress.converting || 0.0001)},
            ...progress,
          } : progress
          setFiles(files =>
            updateLeaf(files, path, leaf => ({
              file: leaf.file, progress: newProgress})))
        })
      }

    })())
  }, [files.size])


  async function debugRun(
    file: File,
    onProgress: (progress: FileTreeLeaf["progress"]) => void
  ) {
    onProgress({"converting": 0})
    const ctx = canvasRef.current!.getContext("2d")!
    const video = new Video(file)
    await video.init({libavoptions: {noworker: true}})
    console.log({stream: video.videoStream})
    let i = 0;
    let lastFrame: VideoFrame | null = null
    let startTime = 0
    while (true) {
      await video.flushAndPrimeVideoDecoder()
      const result = await video.libav.avformat_seek_file_max(
        video.formatContext,
        video.videoStream.index,
        50000000, 0,
        0)
      if (result !== 0) {
        throw new Error("Search failed: " + result)
      }
      skipRef.current = 0
      await new Promise(resolve => window.setTimeout(resolve, 100))
      for await (const frame of video.getFrames()) {
        const now = Date.now()
        if (startTime === 0) {
          startTime = now - frame.timestamp / 1000
        } else {
          const waitTime = startTime + frame.timestamp / 1000 - now
          if (waitTime > 0) {
            await new Promise(resolve => window.setTimeout(resolve, waitTime))
          }
        }
        i+= 1
        ctx.drawImage(frame, 0, 0, 640, 360)
        onProgress({"converting": i / 45000})
        if (lastFrame) lastFrame.close()
        lastFrame = frame
        if (skipRef.current !== 0) {
          console.log({skipRef})
          break
        }
      }
    }
    console.log({lastFrame})
    await video.deinit()
    onProgress("done")
  }

  const skipDelta = (diff: number) => {
    skipRef.current += diff
  }

  return <>
    <h1>Debug page -- may do random scary stuff :)</h1>
    <div className={css.explanation}>
      Only to be used by masters
    </div>
    <div className={css.files}>
    {files.size === 0 && <Upload addFiles={addFiles} />}
    {files.size ? <FileTree files={files} removeFile={() => alert("no removal")} /> : "Add files to convert"}
    </div>
    <canvas width="640" height="360" ref={canvasRef}/>
    <button onClick={() => skipDelta(-10)}>-10s</button>
    <button onClick={() => skipDelta(10)}>+10s</button>
  </>
}

