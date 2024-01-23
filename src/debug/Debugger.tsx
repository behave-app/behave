// eslint-disable-next-line import/no-unresolved
import * as LibAVTypes from "../../public/app/bundled/libavjs/dist/libav.types";
import {Upload} from "../lib/Upload"
import {FileTree, FileTreeBranch, readFileSystemHandle, findLeaf, getAllLeafPaths} from "../lib/FileTree"
import * as css from "./debugger.module.css"
import { JSX } from "preact"
import {useRef, useEffect, useState} from 'preact/hooks'
import { Video, combineLowHigh, createFakeKeyFrameChunk} from "../lib/video";
import * as LibAVWebcodecsBridge from "libavjs-webcodecs-bridge";
import { xxhash64 } from "hash-wasm";

function stripPacket(packet: LibAVTypes.Packet): LibAVTypes.Packet {
  const view = new DataView(packet.data.buffer)
  let index = 0
  const parts: Uint8Array[] = []
  while (index < view.byteLength) {
    const length = view.getUint32(index)
    if (length < 2) {
      throw new Error("special case, I run away")
    }
    index += 4
    if ((packet.data.at(index)! & 0x1F) !== 6) {
      parts.push(new Uint8Array(packet.data.buffer.slice(index, index + length)))
    }
    index += length
  }
  const newData = new Uint8Array(parts.map(p => p.length).reduce((a, b) => a + b + 4, 0))
  index = 0
  const newView = new DataView(newData.buffer)
  parts.forEach(p => {
    newView.setUint32(index, p.length)
    newData.set(p, index + 4)
    index += p.length + 4
  })
  packet.data = newData
  return packet
}


async function dumpPacket(packet: LibAVTypes.Packet, framenr: number) {
  const lines = [`frameNumber: ${framenr}`]
  const view = new DataView(packet.data.buffer)
  let index = 0
  while (index < view.byteLength) {
    const length = view.getUint32(index)
    if (length < 2) {
      console.log("special case, I run away")
      return
    }
    index += 4
    const startBytes = new Uint8Array(
      packet.data.buffer.slice(index, index + Math.min(length, 16)))
    const h = await xxhash64(new Uint8Array(packet.data.buffer.slice(index, index + length)))
    const str = [...startBytes].map(b => b.toString(16).padStart(2, "0")).join(" ")
    lines.push(`length ${length} (${h}): ${str}`)
    index += length
  }
  console.log(lines[0] + ": " + lines.slice(1).map(l => l.split(":")[1].slice(1, 3)).join(" "))
}

export function Debugger(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [video, setVideo] = useState<Video | null>(null)

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
    void((async () => {
      if (!video) {
          return
      }
      await video.packetStreamSeek(0)
      for (let i=0; i < 635; i++) {
        const packet = await video.packetStreamNext()
        if (packet === null) {
          continue
        }
        if ((i % 2) == 0) {
          await dumpPacket(packet, i/ 2)
        }
      }
    })())
  }, [video])

  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const newFiles = await readFileSystemHandle(
      fileSystemHandles,
      file => file.name.endsWith(".mp4") || file.name.endsWith(".MTS")
    )

    // only set files if none there
    setFiles(files => files.size ? files : newFiles)
  }


  return <>
      {files.size === 0 && <Upload addFiles={addFiles} />}
  </>
}


export function Debugger3(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [shownFrames, setShownFrames] = useState<number[]>([])
  const [video, setVideo] = useState<Video | null>(null)

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
    void((async () => {
      if (!video) {
          return
      }
      const startTick = video.videoInfo.startTick
      const frameDurationTicks = video.videoInfo.frameDurationTicks
      let i = 0 ;
      const videoDecoder = await video.getInitialisedVideoDecoder((frame: VideoFrame) => {
        const tick = Math.round(frame.timestamp / video.ticksToUsFactor)
        const frameNumber = (tick - startTick) / frameDurationTicks
        if (frameNumber === i) {
          setShownFrames(s => [...s, i])
        }
        frame.close()
      })
      for (i=0; i < video.videoInfo.numberOfFramesInStream; i++) {
        await video.packetStreamSeek(i - 3)
        for (let j = 0; j < 50; j++) {
          let packet = await video.packetStreamNext()
          if (packet === null) {
            continue
          }
          packet = stripPacket(packet)
          const chunk = new EncodedVideoChunk({
            type: ((packet.flags ?? 0) & Video.AV_PKT_FLAG_KEY) ? "key" : "delta",
            timestamp: combineLowHigh(packet.pts!, packet.ptshi!) * video.ticksToUsFactor,
            duration: 100,
            data: packet.data.buffer,
          })
          videoDecoder.decode(chunk)
        }
        await videoDecoder.flush()
        videoDecoder.decode(await createFakeKeyFrameChunk(
          await LibAVWebcodecsBridge.videoStreamToConfig(
            video.libav, video.videoStream) as VideoDecoderConfig));
      }
    })())
  }, [video])

  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const newFiles = await readFileSystemHandle(
      fileSystemHandles,
      file => file.name.endsWith(".mp4") || file.name.endsWith(".MTS")
    )

    // only set files if none there
    setFiles(files => files.size ? files : newFiles)
  }


  return <>
      {files.size === 0 && <Upload addFiles={addFiles} />}
    <button onClick={() => {void(navigator.clipboard.writeText(shownFrames.map(s => s.toString()).join("\n")))}}>Copy {shownFrames.length} shown frames</button>
  </>
}

export function Debugger1(): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [frameNr, setFrameNr] = useState(0)
  const [customFrameNr, setCustomFrameNr] = useState("0")
  const [numberAndFrame, setNumberAndFrame] =
    useState<[number, VideoFrame | "EOF"]>()
  const [video, setVideo] = useState<Video | null>(null)
  const [sliderIsClicked, setSliderIsClicked] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shownFrames, setShownFrames] = useState<number[]>([])


  useEffect(() => {
    if (!video) return;
    if (sliderIsClicked) return;
    let i = frameNr
    const interval = window.setInterval(() => {
      void(video.getFrame(35656))
      setFrameNr(i++)
    }, 1000)
    return () => window.clearInterval(interval)
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
      setShownFrames(s => [...s, frameNumber])
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
    <div>
      <canvas width="640" height="360" ref={canvasRef}/>
    </div>
    <div>
      <button onClick={() => skipDelta(-10)}>-10s</button>
      <button onClick={() => skipDelta(10)}>+10s</button>
      <button onClick={() => setFrameNr(35656)}>35656</button>
      <button onClick={() => setFrameNr(35696)}>35696</button>
      <input type="text" value={customFrameNr} onInput={
        e => setCustomFrameNr((e.target as HTMLInputElement).value)} />
      <button onClick={() => setFrameNr(parseInt(customFrameNr))}>{parseInt(customFrameNr)}</button>
      <button onClick={() => {setCustomFrameNr(f => (parseInt(f) + 1).toString()); setFrameNr(parseInt(customFrameNr) + 1)}}>{parseInt(customFrameNr) + 1}</button>
        <button onClick={() => {void(navigator.clipboard.writeText(shownFrames.map(s => s.toString()).join("\n")))}}>Copy shown frames</button>
    </div>
    <div style={{width: "100%"}}>
      <input type="range" min="0" max={(video && video.videoInfo && video.videoInfo.numberOfFramesInStream || 1) - 1} value={frameNr} onMouseDown={() => setSliderIsClicked(true)} onMouseUp={() => setSliderIsClicked(false)} onInput={e => {const val = (e.target as HTMLInputElement).valueAsNumber; console.log("set", val); setFrameNr(val)} } />
    {frameNr} = 
      {frameNr % 300 === 2 ? "IDR"
      : frameNr % 12 === 2 ? "I"
      : frameNr % 3 === 2 ? "P" : "B"}-frame (simple heuristic, don't trust me)

    </div>
  </>
}

