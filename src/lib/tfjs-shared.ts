export const YOLO_MODEL_NAME_FILE = "modelname.txt"
export const YOLO_MODEL_DIRECTORY = "YoloModelDir"
export type YoloSettings = {
  version: 1,
  modelFilename: string,
  backend: YoloBackend,
}

export type YoloBackend = "wasm" | "webgpu"
