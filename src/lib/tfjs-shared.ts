export const YOLO_MODEL_NAME_FILE = "modelname.txt"
export const YOLO_MODEL_DIRECTORY = "YoloModelDir"
export type YoloSettings = {
  version: 1,
  yoloVersion: YoloVersion,
  modelFilename: string,
  backend: YoloBackend,
}

export type YoloBackend = "wasm" | "webgl" | "webgpu"
export type YoloVersion = "v5" | "v8"
