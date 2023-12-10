import * as tf from '@tensorflow/tfjs'
import {setWasmPaths} from "@tensorflow/tfjs-backend-wasm"
setWasmPaths("app/bundled/tfjs-wasm/")
import "@tensorflow/tfjs-backend-webgl"
import "@tensorflow/tfjs-backend-webgpu"
import type {FileTreeLeaf} from "../lib/FileTree.js"
import {getNumberOfFrames, Video} from "../lib/video.js"
import { xxh64sum } from 'src/lib/fileutil.js'
import { parse as YAMLParse } from "yaml"


export function getOutputFilename(inputfilename: string) {
  const parts = inputfilename.split(".")
  const baseparts = parts.length == 1 ? parts : parts.slice(0, -1)
  return [...baseparts, "csv"].join(".")
}
export type YoloBackend = "wasm" | "webgl" | "webgpu"
export type YoloVersion = "v5" | "v8"

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
    name: modelDirectory.name,
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
    console.log({model})
  }
  if (typeof metadata.ModelName === "string") {
    model.name = metadata.ModelName
  }

  return model
}

const NR_FRAMES_PROGRESS_PART = 0.001
const HASH_PROGRESS_PART = 0.002
const PROGRESS_INTERVAL_MS = 300

export async function convert(
  model: Model,
  yoloVersion: YoloVersion,
  file: File,
  outputstream: FileSystemWritableFileStream,
  onProgress: (progress: FileTreeLeaf["progress"]) => void,
  ctx?: CanvasRenderingContext2D,
) {
  onProgress({"converting": 0})
  const numberOfFrames = await getNumberOfFrames(file)
  onProgress({"converting": NR_FRAMES_PROGRESS_PART})
  const hash = await xxh64sum(file, progress => {
    onProgress({"converting": NR_FRAMES_PROGRESS_PART + progress * HASH_PROGRESS_PART})
  })
  let framenr = 0;
  const textEncoder = new TextEncoder()
  await outputstream.write(textEncoder.encode([
    `# version: 1`,
    `# Total number of frames: TO_FILL`,
    `# Source file name: ${file.name}`,
    `# Source file xxHash64: ${hash}`,
    `# Model name: ${model.name}`,
    `# Model klasses: ${JSON.stringify(model.klasses)}`,
    `# Framenumber, Class, x, y, w, h, confidence`,
    `# (x, y) is the left top of the detection`,
    `# all coordinates are on frame where left-top = (0, 0) and right-bottom is (1, 1)`,
  ].join("\n") + "\n"
  ))
  let lastProgress = Date.now()
  const video = new Video(file)
  await video.init({libavoptions: {noworker: true}})
  for await (const videoFrame of video.getFrames()) {
    const [boxes, scores, classes] = await infer(model, yoloVersion, videoFrame)
    if (ctx) {
      ctx.drawImage(videoFrame, 0, 0)
      ctx.strokeStyle = "red"
      ctx.lineWidth = 5;
    }
    for (let i = 0; i < scores.length; i++) {
      const [x1, y1, x2, y2] = boxes.slice(i * 4, (i + 1) * 4)
      const box = [(x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1]
      const score = scores.at(i)!
      const klass = classes.at(i)!
      if (!Number.isInteger(klass)) {
        throw new Error(`Class is not an int? ${i} ${boxes}, ${scores} ${classes}`)
      }
      const line = `${framenr},${klass.toFixed(0)},${[...box].map(c => c.toFixed(4)).join(",")},${score.toFixed(3)}\n`
      await outputstream.write(textEncoder.encode(line))
      const [cx, cy, w, h] = box
      if (ctx) {
        const scale = Math.max(videoFrame.displayWidth, videoFrame.displayHeight)
        ctx.strokeRect(
          (cx - w / 2) * scale, (cy - h / 2) * scale, w * scale, h * scale,
        )
      }
    }
    videoFrame.close()
    const now = Date.now()
    if (now - lastProgress > PROGRESS_INTERVAL_MS) {
      const progress = Math.min(
        NR_FRAMES_PROGRESS_PART + HASH_PROGRESS_PART
          + framenr / numberOfFrames * (1 - (NR_FRAMES_PROGRESS_PART + HASH_PROGRESS_PART)), 1)
      onProgress({"converting": progress})
      lastProgress = now
    }
    framenr++
  }
  await video.deinit()
  await outputstream.seek(0)
  await outputstream.write(textEncoder.encode(
    `# version: 1\n# Total number of frames: ${framenr.toString().padStart(7," ")}`))
  onProgress({"converting": 1})
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

export async function infer(
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
