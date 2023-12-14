import {Upload} from "../lib/Upload.js"
import {FileTree, FileTreeLeaf, FileTreeBranch, readFileSystemHandle, findLeaf, updateLeaf, getAllLeafPaths} from "../lib/FileTree.js"
import * as css from "./debugger.module.css"
import { JSX } from "preact"
import {useRef, useEffect, useState} from 'preact/hooks'
import { Video } from "../lib/video";


export function Debugger(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [frameNr, setFrameNr] = useState(0)
  const [numberAndFrame, setNumberAndFrame] =
    useState<[number, VideoFrame | "EOF"]>()
  const [video, setVideo] = useState<Video | null>(null)
  const [sliderIsClicked, setSliderIsClicked] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!video) return;
    if (sliderIsClicked) return;
    //const interval = window.setInterval(() => setFrameNr(n => n + 1), 40)
    //return () => window.clearInterval(interval)
  }, [video, sliderIsClicked])

  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const newFiles = await readFileSystemHandle(
      fileSystemHandles,
      file => file.name.endsWith(".mp4") || file.name.endsWith(".MTS")
    )

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
        const video = new Video(leaf.file)
        await video.init({libavoptions: {noworker: true}})
        setVideo(video)
        break
      }

    })())
  }, [files.size])

  useEffect(() => {
    if (video === null) {
      return
    }
    void((async (frameNumber: number) => {
      const frame = await video.getFrame(frameNumber)
      console.log(`got ${frameNumber}: ${frame === null ? "" : "not"} null`)
      if (frame === null) {
        return
      }
      setNumberAndFrame([frameNumber, frame])
    })(frameNr))
  }, [frameNr, video])

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }
    if (numberAndFrame === undefined) {
      return
    }
    const [frameNumber, frame] = numberAndFrame
      const ctx = canvasRef.current.getContext("2d")!
      if (frame === "EOF") {
        ctx.fillStyle = "blue"
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      } else {
        ctx.drawImage(frame, 0, 0, canvasRef.current.width, canvasRef.current.height)
      }
      ctx.font = "48px sans-serif"
      ctx.fillStyle = "yellow"
      ctx.fillText(frameNumber.toString(), 10, 40)
    }, [numberAndFrame])

  const skipDelta = (diff: number) => {
    setFrameNr(frameNr => frameNr + diff)
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
    <button onClick={() => setFrameNr(35656)}>35656</button>
    <button onClick={() => setFrameNr(35696)}>35696</button>
    <div style={{width: "100%"}}>
      <input type="range" min="0" max={(video && video.videoInfo && video.videoInfo.numberOfFramesInStream || 1) - 1} value={frameNr} onMouseDown={() => setSliderIsClicked(true)} onMouseUp={() => setSliderIsClicked(false)} onInput={e => {const val = (e.target as HTMLInputElement).valueAsNumber; console.log("set", val); setFrameNr(val)} } />
    {frameNr} = 
      {frameNr % 300 === 2 ? "IDR"
      : frameNr % 12 === 2 ? "I"
      : frameNr % 3 === 2 ? "P" : "B"}-frame (simple heuristic, don't trust me)

    </div>
  </>
}

