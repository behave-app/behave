export type YoloSettings = {
  version: 1,
  model: {
    name: string,
    zipFileHandle: FileSystemFileHandle,
  } | null,
  backend: YoloBackend,
}
export type YoloSettingsOnDisk = Omit<YoloSettings, "model"> & {
  model: null | {name: string}}

export type YoloBackend = "wasm" | "webgl" | "webgpu"
