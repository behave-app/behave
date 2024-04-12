export const YOLO_MODEL_NAME_FILE = "modelname.txt"
export type YoloSettings = {
  version: 1,
  yoloVersion: YoloVersion,
  modelDirectory: FileSystemDirectoryHandle,
  backend: YoloBackend,
}

export type YoloBackend = "wasm" | "webgl" | "webgpu"
export type YoloVersion = "v5" | "v8"
