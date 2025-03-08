// eslint-disable-next-line import/no-unresolved -- eslint has wrong resolve rules somehow
import { env, InferenceSession, TypedTensor, Tensor } from 'onnxruntime-web/all';
import {nonEmptyFileExists, type FileTreeLeaf} from "../lib/FileTree"
import {Video} from "./video"
import { xxh64sum } from '../lib/fileutil'
import { DetectionInfo, SingleFrameInfo, detectionInfoToStrings } from '../lib/detections'
import { ObjectEntries, ObjectFromEntries, ObjectKeys, argMax, assert, enumerate, enumerateAsyncGenerator, exhausted, range } from '../lib/util'
import { EXTENSIONS } from '../lib/constants'
import { YoloSettings, YoloBackend, getSavedModelFileHandleFromName } from '../lib/tfjs-shared'
import {load} from "protobufjs"
import { AutoConfigureAndTestModelDone } from './Api';

env.wasm.wasmPaths = "../bundled/ort-wasm/"

const NMS_MODEL_PATH = "../../assets/nms.ed6dba6edf.onnx"
const ONNX_PROTO_PATH = "../../assets/onnx.e1280384e3.proto"
const TEST_VIDEO_FRAME_PATH = "../../assets/video-frame.229cb58880.jpeg"

export type Model = {
  name: string
  model: InferenceSession
  nms: InferenceSession | null
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
  modelFile: FileSystemFileHandle,
  backend: YoloBackend,
  needsNms: boolean,
): Promise<Model> {
  const buffer = await (await modelFile.getFile()).arrayBuffer()
  const metadata = await readModelMetadata(buffer)
  const model = await InferenceSession.create(buffer, {executionProviders: [backend]})
  const nmsModelData = await (await fetch(NMS_MODEL_PATH)).arrayBuffer()
  const nms = needsNms ? await InferenceSession.create(nmsModelData) : null
  return {
    model,
    nms,
    name: modelFile.name,
    metadata,
  }
}

const MODEL_TEST_WARMUP_ROUNDS =1
const MODEL_TEST_RUN_ROUNDS = 3
const MODEL_TEST_RUN_MAX_TIME_MS = 5000

export async function autoConfigureAndTestModel(
  modelFile: FileSystemFileHandle,
  progress: (progress: number) => void,
): Promise<AutoConfigureAndTestModelDone> {
  const buffer = await (await modelFile.getFile()).arrayBuffer()
  const metadata = await readModelMetadata(buffer)
  const needsNms = (() => {
    if (metadata.outputDimensions[2] !== 6) {
      return true
    }
    if (metadata.outputDimensions[1] !== 4 + Object.keys(metadata.klasses).length) {
      return false
    }
    throw new Error("Heuristics to determine nms fails, please report this error")
  })()
  const performance: AutoConfigureAndTestModelDone["performance"] = {
    wasm: {msPerInfer: NaN},
    webgpu: {msPerInfer: NaN},
  }
  const BACKENDS = ObjectKeys(performance)
  for (const [i, backend] of enumerate(BACKENDS)) {
    performance[backend] = await testModel(modelFile, backend, needsNms, testModelProgress => {
      progress((i + testModelProgress) / BACKENDS.length)
    })
  }
  return {
    performance,
    modelNeedsNms: needsNms,
  }
}

export async function testModel(
  modelFile: FileSystemFileHandle,
  backend: YoloSettings["backend"],
  needsNms: boolean,
  progress: (progress: number) => void,
): Promise<{msPerInfer: number} | {error: Error}> {
  try {
    const model = await getModel(modelFile, backend, needsNms)
    const blob = await (await fetch(TEST_VIDEO_FRAME_PATH)).blob()
    const videoFrame = new VideoFrame(await globalThis.createImageBitmap(blob),
      {timestamp: 0})
    const totalruns = MODEL_TEST_WARMUP_ROUNDS + MODEL_TEST_RUN_ROUNDS
    for (let i=0; i < MODEL_TEST_WARMUP_ROUNDS; i++) {
      await inferSingleFrame(model, videoFrame);
      progress((i + 1) / totalruns)
    }
    const startTime = Date.now()
    let nrRuns = 0
    for (nrRuns=0; nrRuns < MODEL_TEST_RUN_ROUNDS; nrRuns++) {
      await inferSingleFrame(model, videoFrame);
      progress((MODEL_TEST_WARMUP_ROUNDS + nrRuns + 1) / totalruns)
      if (Date.now() - startTime > MODEL_TEST_RUN_MAX_TIME_MS) {
        nrRuns++
        break;
      }
    }
    return {msPerInfer: (Date.now() - startTime) / nrRuns}
  } catch (e) {
    return {error: e instanceof Error ? e : new Error("unknown claude error")}
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
  const model = await getModel(
    await getSavedModelFileHandleFromName(yoloSettings.modelFilename),
    yoloSettings.backend, yoloSettings.needsNms)
  await infer(model, input, output, forceOverwrite, onProgress)
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
    const modelKlasses = new Set<`${number}`>(
      ObjectKeys(detectionInfo.modelKlasses))
    for await (const [framenr, videoFrame] of
    enumerateAsyncGenerator(video.getFrames())) {
      const singleFrameInfo = {
        detections: await inferSingleFrame(model, videoFrame)
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
    if (video) {
      await video.deinit()
    }
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
  ctx.fillStyle = "rgb(114, 114, 114)"
  ctx.fillRect(0, 0, modelWidth, modelHeight)
  ctx.drawImage(videoFrame, drawX, drawY, drawWidth, drawHeight)

  const tensor = await Tensor.fromImage(
    offScreenCanvas.transferToImageBitmap(), {}
  ) as TypedTensor<"float32">
  
  return {tensor, toNormalized: {
    x: x => (x - drawX) / drawWidth,
    y: y => (y - drawY) / drawHeight,
    width: width => width / drawWidth,
    height: height => height / drawHeight,
  }}
}

const TOPK = 100
const IOUTHRESHOLD = 0.45;
const SCORETHRESHOLD = 0.25;
const NMS_CONFIG = new Tensor(
  "float32",
  new Float32Array([
    TOPK, // topk per class
    IOUTHRESHOLD, // iou threshold
    SCORETHRESHOLD, // score threshold
  ])
); // nms config tensor

export async function inferSingleFrame(
  model: Model,
  videoFrame: VideoFrame,
): Promise<InferResult> {
  const {tensor, toNormalized} = await preprocess(videoFrame, model)
  const { output0 } = await model.model.run({images: tensor})
  if (model.nms) {
    const { selected } = await model.nms.run({ detection: output0, config: NMS_CONFIG });
    output0.dispose()
    assert(selected.dims.length === 3)
    assert(selected.dims[0] === 1)
    const [nrRows, rowLength] = selected.dims.slice(1)
    assert(rowLength === 4 + Object.keys(model.metadata.klasses).length)
    const data = await selected.getData() as Float32Array
    selected.dispose()
    const result = range(nrRows).map(rowNr => {
      const row = data.slice(rowNr * rowLength, (rowNr + 1) * rowLength)
      const cx = toNormalized.x(row[0])
      const cy = toNormalized.y(row[1])
      const width = toNormalized.width(row[2])
      const height = toNormalized.height(row[3])
      const {maxIndex: klass, maxValue: confidence} = argMax([...row.slice(4)])!
      return {klass, cx, cy, width, height, confidence}
    })
    return result
  } else {
    assert(output0.dims.length === 3)
    const [batchSize, nrRows, rowLength] = output0.dims
    assert(batchSize === 1)
    assert(rowLength === ["x", "y", "w", "h", "class", "conf"].length)
    const data = await output0.getData() as Float32Array
    output0.dispose()
    const result: Array<InferResult[0]> = []
    for (let i = 0; i < nrRows; i++) {
      const [x0, y0, x1, y1, confidence, klass] = data.slice(rowLength * i, rowLength * (i + 1))
      if (confidence < SCORETHRESHOLD) {
        break
      }
      const cx = toNormalized.x((x0 + x1) / 2)
      const cy = toNormalized.y((y0 + y1) / 2)
      const width = toNormalized.width(x1 - x0)
      const height = toNormalized.height(y1 -y0)
      result.push({klass, cx, cy, width, height, confidence})
    }
    return result
  }
}

