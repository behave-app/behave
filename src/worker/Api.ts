declare const WORKER_URL: string;

import { exhausted, promiseWithResolve} from "../lib/util"
import {FileTreeLeaf} from "../lib/FileTree"
import { YoloBackend, YoloSettings } from "../lib/tfjs-shared"
import { VideoMetadata } from "../lib/video-shared"
import { tic } from "../lib/insight";

export type WorkerMethod = WorkerConvertMethod | WorkerInferMethod | WorkerCheckValidModel | WorkerExtractMetadata

export type WorkerConvertMethod = {
  call: {
    method: "convert",
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
    forceOverwrite: boolean
  }
  message: {type: "progress", progress: FileTreeLeaf["progress"]}
  | {type: "done"}
  | {type: "error", error: Error}
}

export type WorkerInferMethod = {
  call: {
    method: "infer",
    yoloSettings: YoloSettings | null
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
    forceOverwrite: boolean
  }
  message: {type: "progress", progress: FileTreeLeaf["progress"]}
  | {type: "done"}
  | {type: "error", error: Error}
}

export type WorkerCheckValidModel = {
  call: {
    method: "check_valid_model",
    backend: YoloBackend
    directory: FileSystemDirectoryHandle
  }
  message: {type: "done", result: {name: string}}
  | {type: "error", error: Error}
}

export type WorkerExtractMetadata = {
  call: {
    method: "extract_metadata",
    file: File,
  }
  message: {type: "done", result: VideoMetadata}
  | {type: "error", error: Error}
}

type LimitedWorker<T extends WorkerMethod> = Omit<Worker, "postMessage"> & {
  postMessage: (call: T["call"]) => void
}

type ConvertWorker = LimitedWorker<WorkerConvertMethod>
type InferWorker = LimitedWorker<WorkerInferMethod>
type ValidModelWorker = LimitedWorker<WorkerCheckValidModel>
type ExtractMetadataWorker = LimitedWorker<WorkerExtractMetadata>

export class API {
  static async convertToMp4(
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
    forceOverwrite: boolean,
    onProgress: (progress: FileTreeLeaf["progress"]) => void
  ): Promise<void> {
    const {promise, resolve, reject} = promiseWithResolve<void>()
    const worker = new Worker(WORKER_URL, {name: "convertor"}) as ConvertWorker
    worker.addEventListener("message", e => {
      const data = e.data as WorkerConvertMethod["message"]
      switch (data.type) {
        case "progress":
          onProgress(data.progress)
          break
        case "done":
          tic(input.file, "convert-done")
          resolve();
          break
        case "error":
          reject(data.error)
          break
        default:
          exhausted(data)
      }
    })
    worker.postMessage({method: "convert", input, output, forceOverwrite})
    return promise
  }

  static inferVideo(
    yoloSettings: YoloSettings | null,
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
    forceOverwrite: boolean,
    onProgress: (progress: FileTreeLeaf["progress"]) => void,
  ): Promise<void> {
    const {promise, resolve, reject} = promiseWithResolve<void>()
    const worker = new Worker(WORKER_URL, {name: "inferrer"}) as InferWorker
    worker.addEventListener("message", e => {
      const data = e.data as WorkerConvertMethod["message"]
      switch (data.type) {
        case "progress":
          onProgress(data.progress)
          break
        case "done":
          tic(input.file, "infer-done")
          resolve();
          break
        case "error":
          reject(data.error)
          break
        default:
          exhausted(data)
      }
    })
    worker.postMessage({method: "infer", yoloSettings, input, output, forceOverwrite})
    return promise
  }

  static checkValidModel(
    yoloBackend: YoloBackend,
    directory: FileSystemDirectoryHandle,
  ): Promise<{name: string}> {
    const {promise, resolve, reject} = promiseWithResolve<{name: string}>()
    const worker = new Worker(WORKER_URL, {name: "checkValidModel"}) as ValidModelWorker
    worker.addEventListener("message", e => {
      const data = e.data as WorkerCheckValidModel["message"]
      switch (data.type) {
        case "done":
          resolve(data.result);
          break
        case "error":
          reject(data.error)
          break
        default:
          exhausted(data)
      }
    })
    worker.postMessage({method: "check_valid_model", backend: yoloBackend, directory})
    return promise
  }

  static extractMetadata(
    file: File,
  ): Promise<VideoMetadata> {
    const {promise, resolve, reject} = promiseWithResolve<VideoMetadata>()
    const worker = new Worker(WORKER_URL, {name: "extractMetadata"}) as ExtractMetadataWorker
    worker.addEventListener("message", e => {
      const data = e.data as WorkerExtractMetadata["message"]
      switch (data.type) {
        case "done":
          resolve(data.result);
          break
        case "error":
          reject(data.error)
          break
        default:
          exhausted(data)
      }
    })
    worker.postMessage({method: "extract_metadata", file})
    return promise
  }
}
self.postMessage("ready")
