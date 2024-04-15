import * as tf from '@tensorflow/tfjs'
import {setWasmPaths} from "@tensorflow/tfjs-backend-wasm"
setWasmPaths("app/bundled/tfjs-wasm/")
import "@tensorflow/tfjs-backend-webgl"
import "@tensorflow/tfjs-backend-webgpu"
import {nonEmptyFileExists, type FileTreeLeaf} from "../lib/FileTree"
import {Video} from "./video"
import { getEntry, xxh64sum } from '../lib/fileutil'
import { parse as YAMLParse } from "yaml"
import { DetectionInfo, SingleFrameInfo, detectionInfoToString } from '../lib/detections'
import { ObjectEntries, assert } from '../lib/util'
import { EXTENSIONS } from '../lib/constants'
import { YOLO_MODEL_NAME_FILE, YoloSettings, YoloBackend, YoloVersion } from '../lib/tfjs-shared'

export async function setBackend(backend: YoloBackend) {
  await tf.setBackend(backend)
  await tf.ready()
  console.log("TF backend is now", tf.backend())
}

interface ModelData {
  weightsManifest: {paths: string[]}[]
}

export type Model = {
  klasses: {[key: number]: string}
  name: string
  model: tf.GraphModel<string>
}

export async function getModel(
  modelDirectory: FileSystemDirectoryHandle
): Promise<Model> {
  const modelName = (await getEntry(modelDirectory, [YOLO_MODEL_NAME_FILE]))
    ?  await modelDirectory.getFileHandle(YOLO_MODEL_NAME_FILE).then(
      fh => fh.getFile()).then(f => f.text()) : "<no name>"
  const modelFile = await modelDirectory.getFileHandle("model.json").then(
    fh => fh.getFile())
  const modelData = JSON.parse(await modelFile.text()) as ModelData
  const weightFiles = await Promise.all(
    modelData.weightsManifest[0].paths.map(
      name => modelDirectory.getFileHandle(name).then(fh => fh.getFile())))
  const graphModel = await tf.loadGraphModel(
    tf.io.browserFiles([modelFile, ...weightFiles]))
  const model: Model = {
    model: graphModel,
    name: modelName,
    klasses: {},
  }
  let metaDataFile;
  try {
    metaDataFile = await modelDirectory.getFileHandle("metadata.yaml").then(
      fh => fh.getFile())
  } catch (e) {
    console.log("No metadata info")
    return model
  }
  let metadata
  try {
    metadata = YAMLParse(await(metaDataFile.text()))
  } catch (e) {
    console.log("Error parsing yaml file")
    return model
  }
  if (typeof metadata.names === "object"
    && Object.entries(metadata.names).every(([key, value]) =>
    Number.isInteger(parseInt(key)) && typeof value === "string")) {
    model.klasses = Object.fromEntries(Object.entries(metadata.names as Record<string, string>).map(
      ([key, value]) => [parseInt(key), value]))
  }
  if (typeof metadata.ModelName === "string") {
    model.name = metadata.ModelName
  }

  return model
}

const PROGRESS_INTERVAL_MS = 300

export async function getModelAndInfer(
  yoloSettings: YoloSettings | null,
  input: {file: File},
  output: {dir: FileSystemDirectoryHandle},
  onProgress: (progress: FileTreeLeaf["progress"]) => void,
) {
  if (yoloSettings) {
    await setBackend(yoloSettings.backend)
    const model = await getModel(yoloSettings.modelDirectory)
    await infer(model, yoloSettings.yoloVersion, input, output, onProgress)
  } else {
    await infer(null, "v8", input, output, onProgress)
  }
}

export async function infer(
  model: Model | null,
  yoloVersion: YoloVersion,
  input: {file: File},
  output: {dir: FileSystemDirectoryHandle},
  onProgress: (progress: FileTreeLeaf["progress"]) => void,
) {
  const updateProgress = (step: "hash" | "infer", progress: number) => {
    const DURATIONS: {[key in Parameters<typeof updateProgress>[0]]: number} = {
      hash: .01,
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

  try {
    const parts = input.file.name.split(".")
    const baseparts = parts.length == 1 ? parts : parts.slice(0, -1)
    const hash = await xxh64sum(input.file, progress => updateProgress(
      "hash", progress))
    outputfilename = [...baseparts, hash, EXTENSIONS.detectionFile].join(".")
    if (await nonEmptyFileExists(output.dir, outputfilename.split("/"))) {
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
      modelName: model ? model.name : null,
      modelKlasses: model ? model.klasses : {},
      framesInfo: []
    }
    let lastProgress = Date.now()
    let frameCount = 0
    for await (const [framenr, videoFrame] of video.getFrames()) {
      assert(frameCount > 0 || framenr == 0, "first frame should have nr 0")
      frameCount++
      const singleFrameInfo = {
        detections: []
      } as SingleFrameInfo

    const [boxes, scores, classes] = model
      ? await inferSingleFrame(model, yoloVersion, videoFrame) : [[], [], []]
    for (let i = 0; i < scores.length; i++) {
      const [x1, y1, x2, y2] = boxes.slice(i * 4, (i + 1) * 4)
      const box = [(x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1]
      const score = scores.at(i)!
      const klass = classes.at(i)!
      if (!Number.isInteger(klass)) {
        throw new Error(`Class is not an int? ${i} ${boxes}, ${scores} ${classes}`)
      }
      const [cx, cy, width, height] = box

      singleFrameInfo.detections.push(
        {klass, cx, cy, width, height, confidence: score})
    }
    detectionInfo.framesInfo.push(singleFrameInfo)
    videoFrame.close()
    const now = Date.now()
      if (now - lastProgress > PROGRESS_INTERVAL_MS) {
        updateProgress("infer", framenr / numberOfFrames)
        lastProgress = now
      }
    }
    const completeDetectionInfo = {
      ...detectionInfo,
    }
    const stringData = detectionInfoToString(completeDetectionInfo)
    const textEncoder = new TextEncoder()
    await outputstream.write(textEncoder.encode(stringData))
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

export function preprocess(
  videoFrame: VideoFrame,
  modelWidth: number,
  modelHeight: number
): [tf.Tensor<tf.Rank>, number, number] {
  const offScreenCanvas = new OffscreenCanvas(videoFrame.displayWidth, videoFrame.displayHeight)
  const ctx = offScreenCanvas.getContext("2d")!
  ctx.drawImage(videoFrame, 0, 0)

  const img = tf.browser.fromPixels(offScreenCanvas.transferToImageBitmap())

  const [h, w] = img.shape.slice(0, 2); // get source width and height
  const maxSize = Math.max(w, h); // get max size
  const imgPadded = img.pad([
    [0, maxSize - h], // padding y [bottom only]
    [0, maxSize - w], // padding x [right only]
    [0, 0],
  ]) as tf.Tensor3D;

  const xRatio = maxSize / w; // update xRatio
  const yRatio = maxSize / h; // update yRatio

  const image = tf.image
  .resizeBilinear(
    imgPadded,
    [modelWidth, modelHeight]) // resize frame
  .div(255.0) // normalize
  .expandDims(0); // add batch

  return [image, xRatio, yRatio]
}

function getBoxesAndScoresAndClassesFromResult(
  inferResult: tf.Tensor<tf.Rank>
): [tf.Tensor<tf.Rank>, tf.Tensor<tf.Rank>, tf.Tensor<tf.Rank>] {
  const transRes = inferResult.transpose([0, 2, 1]); // transpose result [b, det, n] => [b, n, det]
  const w = transRes.slice([0, 0, 2], [-1, -1, 1]); // get width
  const h = transRes.slice([0, 0, 3], [-1, -1, 1]); // get height
  const x1 = tf.sub(
    transRes.slice([0, 0, 0], [-1, -1, 1]),
    tf.div(w, 2)
  ); // x1
  const y1 = tf.sub(
    transRes.slice([0, 0, 1], [-1, -1, 1]),
    tf.div(h, 2)
  ); // y1
  const boxes = tf
  .concat(
    [
      y1,
      x1,
      tf.add(y1, h), //y2
      tf.add(x1, w), //x2
    ],
    2
  )
  .squeeze();
  const rawScores = transRes.slice([0, 0, 4], [-1, -1, 5]).squeeze([0]); // #6 only squeeze axis 0 to handle only 1 class models
  return [boxes, rawScores.max(1), rawScores.argMax(1)];
}

export async function inferSingleFrame(
  model: Model,
  yoloVersion: YoloVersion,
  videoFrame: VideoFrame,
): Promise<[Float32Array, Float32Array, Float32Array]> {
  const [img_tensor, xRatio, yRatio] = tf.tidy(() => preprocess(videoFrame, 640, 640))
  if (yoloVersion === "v5") {
    const res = await  model.model.executeAsync(img_tensor)
    const [boxes, scores, classes] = (res as tf.Tensor<tf.Rank>[]).slice(0, 3)
    const boxes_scaled = tf.tidy(() => boxes
      .mul([xRatio, yRatio, xRatio, yRatio]))
    const boxes_data = await boxes_scaled.data() as Float32Array// indexing boxes by nms index
    const scores_data = await scores.data() as Float32Array // indexing scores by nms index
    const classes_data = await classes.data() as Float32Array // indexing classes by nms index
    tf.dispose([img_tensor, res, boxes, boxes_scaled, scores, classes]);
    return [boxes_data, scores_data, classes_data]
  } else if (yoloVersion === "v8") {
    const res = tf.tidy(() => model.model.execute(img_tensor))
    const  [boxes, scores, classes] = tf.tidy(
      () => getBoxesAndScoresAndClassesFromResult(res as tf.Tensor<tf.Rank>))
    const nms = await tf.image.nonMaxSuppressionAsync(
      boxes as tf.Tensor2D,
      scores as tf.Tensor1D,
      500,
      0.45,
      0.5
    ); // NMS to filter boxes
    const boxes_nms = tf.tidy(() => 
      boxes
      .gather(nms, 0) // filter by nms columns
      .gather([1, 0, 3, 2], 1)  // go from [y1, x1, y2, x1] to [x1, y1, x2, y2]
      .mul([xRatio / 640, yRatio / 640, xRatio / 640, yRatio / 640])  // fix to coordinates (0,0) - (1, 1)
    )
    const scores_nms = tf.tidy(() => scores.gather(nms, 0))
    const classes_nms = tf.tidy(() => classes.gather(nms, 0))

    const boxes_data = await boxes_nms.data() as Float32Array// indexing boxes by nms index
    const scores_data = await scores_nms.data() as Float32Array // indexing scores by nms index
    const classes_data = await classes_nms.data() as Float32Array // indexing classes by nms index
    tf.dispose([img_tensor, res, boxes, scores, classes, nms, boxes_nms,
      scores_nms, classes_nms]);
    return [boxes_data, scores_data, classes_data]
  } else {
    const exhaustiveOption: never = yoloVersion
    throw new Error(`Exhaustive option: ${exhaustiveOption}`)
  }
}
