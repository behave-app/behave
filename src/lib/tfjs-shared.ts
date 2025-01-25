export const YOLO_MODEL_NAME_FILE = "modelname.txt"
export const YOLO_MODEL_DIRECTORY = "YoloModelDir"
export type YoloSettings = {
  version: 1,
  modelFilename: string,
  autoConfigured: boolean
  backend: YoloBackend,
  needsNms: boolean
}

export const yoloBackends = {
  "wasm": "WASM",
  "webgpu": "WebGPU"
} as const

export type YoloBackend = keyof typeof yoloBackends
export async function getSavedModelFileHandleFromName(
  modelFilename: string
): Promise<FileSystemFileHandle> {
  const opfsRoot = await navigator.storage.getDirectory()
  const modelDir = await opfsRoot.getDirectoryHandle(YOLO_MODEL_DIRECTORY)
  return await modelDir.getFileHandle(modelFilename)
}
