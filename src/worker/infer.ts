import { env, InferenceSession, TypedTensor, Tensor } from 'onnxruntime-web';
import {nonEmptyFileExists, type FileTreeLeaf} from "../lib/FileTree"
import {Video} from "./video"
import { xxh64sum } from '../lib/fileutil'
import { DetectionInfo, SingleFrameInfo, detectionInfoToStrings } from '../lib/detections'
import { ObjectEntries, ObjectFromEntries, ObjectKeys, argMax, assert, exhausted, range } from '../lib/util'
import { EXTENSIONS } from '../lib/constants'
import { YOLO_MODEL_DIRECTORY, YoloSettings, YoloBackend, YoloVersion } from '../lib/tfjs-shared'
import {load} from "protobufjs"

env.wasm.wasmPaths = "../bundled/ort-wasm/"

const NMS_MODEL_PATH = "../../assets/nms.ed6dba6edf.onnx"
const ONNX_PROTO_PATH = "../../assets/onnx.e1280384e3.proto"

// @ts-expect-error: workaround for
// https://github.com/microsoft/onnxruntime/issues/22152
globalThis.HTMLCanvasElement = OffscreenCanvas

export async function setBackend(backend: YoloBackend): Promise<void> {
  console.log("TODO implement setBackend", backend)
}

export type Model = {
  name: string
  model: InferenceSession
  nms: InferenceSession
  metadata: ModelMetadata
}

type ModelMetadata = {
  klasses: Record<`${number}`, string>
  inputDimensions: ReadonlyArray<number>
  outputDimensions: ReadonlyArray<number>
}

async function readModelMetadata(
  data: ArrayBuffer,
): Promise<ModelMetadata> {
  const root = await load(ONNX_PROTO_PATH)
  const ModelProto = root.lookupType("onnx.ModelProto")
  const rawModel = ModelProto.decode(new Uint8Array(data)) as unknown as {
    metadataProps: ReadonlyArray<{key: string, value: string}>
    graph: {
      input: {
        name: string, type: {tensorType: {shape: {dim: {dimValue: number}[]}}}
      }[]
      output: {
        name: string, type: {tensorType: {shape: {dim: {dimValue: number}[]}}}
      }[]
    }
  }

  const klassesInfo = rawModel.metadataProps.find(e => e.key === "names")
  if (klassesInfo === undefined) {
    throw new Error("Expected klasses to be present")
  }
  // klassesInfo.value is an almost-JSON object: keys are numeric, values are singly-quoted strings
  // I could be lazy and use eval(), but I think that's not a good idea. So parse this myself.
  const state = {
    parsed: new Map<number, string>(),
    parsedKey: undefined as number | undefined,
    parsedValue: undefined as string | undefined,
    spot: "preopen" as "preopen" | "postclose"| "prekey" | "postkey" | "prevalue" | "value" | "postvalue"
  }

  const tokenize = function* (s: string): Generator<string> {
    let i = 0;
    while (i < s.length - 1) {
      const token = /\d+|\w+|\\.|./.exec(s.slice(i))![0]
      i += token.length
      yield token
    }
  }
  for (const token of tokenize(klassesInfo.value)) {
    if (token === " " && state.spot !== "value") {
      continue
    }
    switch (state.spot) {
      case "preopen": {
        assert(token === "{", `${token} should be {`)
        state.spot = "prekey"
        break
      }
      case "prekey": {
        assert(/^\d+$/.test(token), `${token} should be numeric`)
        const key = parseInt(token)
        assert(!state.parsed.has(key), `duplicate key $key`)
        state.parsedKey = key
        state.spot = "postkey"
        break
      }
      case "postkey": {
        assert(token === ":", `${token} should be :`)
        state.spot = "prevalue"
        break
      }
      case "prevalue": {
        assert(token === "'", `${token} should be '`)
        state.spot = "value"
        state.parsedValue = ""
        break
      }
      case "value": {
        if (token === "'") {
          state.parsed.set(state.parsedKey!, state.parsedValue!)
          state.parsedKey = undefined
          state.parsedValue = undefined
          state.spot = "postvalue"
        } else {
          if (token[0] === "\\") {
            state.parsedValue = state.parsedValue! + token[1]
          } else {
            state.parsedValue = state.parsedValue! + token
          }
        }
        break
      }
      case "postvalue": {
        if (token === "}") {
          state.spot = "postclose"
        } else {
          assert(token === ",", `${token} should be ,`)
          state.spot = "prekey"
        }
        break
      }
      case "postclose": {
        throw new Error(`Should not be anything postclose, received ${token}`)
      }
      default:
        exhausted(state.spot)
    }
  }
  return {
    klasses: ObjectFromEntries([...state.parsed].map(([k, v]) => [`${k}`, v])),
    inputDimensions: 
      rawModel.graph.input[0].type.tensorType.shape.dim.map(dim => dim.dimValue),
    outputDimensions:
      rawModel.graph.output[0].type.tensorType.shape.dim.map(dim => dim.dimValue)
  }
}

export async function getModel(
  modelFilename: string
): Promise<Model> {
  const opfsRoot = await navigator.storage.getDirectory()
  const modelDir = await opfsRoot.getDirectoryHandle(YOLO_MODEL_DIRECTORY)
  const buffer = await (await (
    await modelDir.getFileHandle(modelFilename)
  ).getFile()).arrayBuffer()
  const metadata = await readModelMetadata(buffer)
  const model = await InferenceSession.create(buffer)
  const nmsModelData = await (await fetch(NMS_MODEL_PATH)).arrayBuffer()
  const nms = await InferenceSession.create(nmsModelData)
  return {
    model,
    nms,
    name: modelFilename,
    metadata,
  }
}

const PROGRESS_INTERVAL_MS = 300

export async function getModelAndInfer(
  yoloSettings: YoloSettings,
  input: {file: File},
  output: {dir: FileSystemDirectoryHandle},
  forceOverwrite: boolean,
  onProgress: (progress: FileTreeLeaf["progress"]) => void,
) {
  // TODO await setBackend(yoloSettings.backend)
  const model = await getModel(yoloSettings.modelFilename)
  await infer(model, yoloSettings.yoloVersion, input, output, forceOverwrite, onProgress)
}

type InferResult = ReadonlyArray<{
  klass: number
  cx: number
  cy: number
  width: number
  height: number
  confidence: number
}>

export async function infer(
  model: Model,
  yoloVersion: YoloVersion,
  input: {file: File},
  output: {dir: FileSystemDirectoryHandle},
  forceOverwrite: boolean,
  onProgress: (progress: FileTreeLeaf["progress"]) => void,
) {
  const updateProgress = (step: "infer", progress: number) => {
    const DURATIONS: {[key in Parameters<typeof updateProgress>[0]]: number} = {
      infer: 1,
    }
    let sumProgress = 0
    for (const [key, value] of ObjectEntries(DURATIONS)) {
      if (key === step) {
        sumProgress += value * progress
        break
      }
      sumProgress += value
    }
    const sum = Object.values(DURATIONS).reduce((a, b) => a + b)
    onProgress({"converting": sumProgress / sum})
  }
  onProgress({"converting": 0})

  let outputfilename: string | undefined = undefined
  let outputstream: FileSystemWritableFileStream | undefined = undefined
  let video: Video | undefined = undefined
  env.wasm.numThreads = 0;
  console.log({threads: env.wasm.numThreads});

  try {
    const parts = input.file.name.split(".")
    const baseparts = parts.length == 1 ? parts : parts.slice(0, -1)
    const hash = await xxh64sum(input.file)
    outputfilename = [...baseparts, ".",  hash, EXTENSIONS.detectionFile].join("")
    if (!forceOverwrite
      && await nonEmptyFileExists(output.dir, outputfilename.split("/"))) {
      onProgress("target_exists")
      return
    }
    const outfile = await output.dir.getFileHandle(outputfilename, {create: true})
    outputstream = await outfile.createWritable()

    video = new Video(input.file)
    await video.init({keepFrameInfo: false})
    const numberOfFrames = video.videoInfo.numberOfFramesInStream
    const detectionInfo: DetectionInfo = {
      version: 1,
      sourceFileName: input.file.name,
      sourceFileXxHash64: hash,
      modelName: model.name,
      modelKlasses: model.metadata.klasses,
      framesInfo: []
    }
    let lastProgress = Date.now()
    let frameCount = 0
    const modelKlasses = new Set<`${number}`>(
      ObjectKeys(detectionInfo.modelKlasses))
    for await (const [framenr, videoFrame] of video.getFrames()) {
      assert(frameCount > 0 || framenr == 0, "first frame should have nr 0", framenr)
      frameCount++
      const singleFrameInfo = {
        detections: await inferSingleFrame(model, yoloVersion, videoFrame)
      } as SingleFrameInfo

      detectionInfo.framesInfo.push(singleFrameInfo)
      videoFrame.close()
      const now = Date.now()
      if (now - lastProgress > PROGRESS_INTERVAL_MS) {
        updateProgress("infer", framenr / numberOfFrames)
        lastProgress = now
      }
    }
    if (modelKlasses.size) {
      detectionInfo.modelKlasses = ObjectFromEntries([...modelKlasses].map(
        klass => [klass, detectionInfo.modelKlasses[klass] ?? `Class-${klass}`]))
    }
    const completeDetectionInfo = {
      ...detectionInfo,
    }
    completeDetectionInfo
    const stringDataIterator = detectionInfoToStrings(completeDetectionInfo)
    const textEncoder = new TextEncoder()
    for (const s of stringDataIterator) {
      await outputstream.write(textEncoder.encode(s))
    }
    console.log("Done writing")
    onProgress({"converting": 1})
    await outputstream.close()
    onProgress("done")
  } catch(e) {
    if (outputstream && outputfilename !== undefined) {
      await outputstream.close()
      await output.dir.removeEntry(outputfilename)
      outputfilename = undefined
      outputstream = undefined
    }
    throw e
  } finally {
    video && await video.deinit()
  }
}



export async function preprocess(
  videoFrame: VideoFrame,
  model: Model,
): Promise<{tensor: TypedTensor<"float32">, toNormalized: {
  x: (modelCoord: number) => number,
  y: (modelCoord: number) => number,
  width: (modelCoord: number) => number,
  height: (modelCoord: number) => number,
}}> {
  const [modelWidth, modelHeight] = model.metadata.inputDimensions.slice(2)
  const imageScale = Math.max(
    videoFrame.displayWidth / modelWidth,
    videoFrame.displayHeight / modelHeight,
    1
  )
  const [drawWidth, drawHeight] = [
    videoFrame.displayWidth / imageScale,
    videoFrame.displayHeight / imageScale,
  ]
  const [drawX, drawY] = [
    Math.floor((modelWidth - drawWidth) / 2),
    Math.floor((modelHeight - drawHeight) / 2),
  ]
  const offScreenCanvas = new OffscreenCanvas(modelWidth, modelHeight)
  const ctx = offScreenCanvas.getContext("2d")!
  ctx.fillStyle = "black"
  ctx.fillRect(0, 0, modelWidth, modelHeight)
  ctx.drawImage(videoFrame, drawX, drawY, drawWidth, drawHeight)
  const tensor = await Tensor.fromImage(
    offScreenCanvas.transferToImageBitmap(), {dataType: "float32"}
  ) as TypedTensor<"float32">
  
  return {tensor, toNormalized: {
    x: x => (x - drawX) / drawWidth,
    y: y => (y - drawY) / drawHeight,
    width: width => width / drawWidth,
    height: height => height / drawHeight,
  }}
}

export async function inferSingleFrame(
  model: Model,
  _yoloVersion: YoloVersion,
  videoFrame: VideoFrame,
): Promise<InferResult> {
  const topk = 100
  const iouThreshold = 0.45;
  const scoreThreshold = 0.25;
  const config = new Tensor(
    "float32",
    new Float32Array([
      topk, // topk per class
      iouThreshold, // iou threshold
      scoreThreshold, // score threshold
    ])
  ); // nms config tensor
  const {tensor, toNormalized} = await preprocess(videoFrame, model)
  const d = Date.now()
  const { output0 } = await model.model.run({images: tensor})
  const d2 = Date.now()
  const { selected } = await model.nms.run({ detection: output0, config: config });
  const d3 = Date.now()
  console.log(`Model run took ${d2 - d}ms, NMS took ${d3-d2}ms`)
  assert(selected.dims.length === 3)
  assert(selected.dims[0] === 1)
  const [nrRows, rowLength] = selected.dims.slice(1)
  assert(rowLength === 4 + Object.keys(model.metadata.klasses).length)
  const data = await selected.getData() as Float32Array
  return range(nrRows).map(rowNr => {
    const row = data.slice(rowNr * rowLength, (rowNr + 1) * rowLength)
    const cx = toNormalized.x(row[0])
    const cy = toNormalized.y(row[1])
    const width = toNormalized.width(row[2])
    const height = toNormalized.height(row[3])
    const {maxIndex: klass, maxValue: confidence} = argMax([...row.slice(4)])!
    return {klass, cx, cy, width, height, confidence}
  })
}

