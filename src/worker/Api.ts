import { exhausted, promiseWithResolve} from "../lib/util"
import {FileTreeLeaf} from "../lib/FileTree"
import { YoloBackend, YoloSettings } from "../lib/tfjs-shared"

export type WorkerMethod = WorkerConvertMethod | WorkerInferMethod | WorkerCheckValidModel
export type WorkerConvertMethod = {
  call: {
    method: "convert",
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
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

type ConvertWorker = Omit<Worker, "postMessage"> & {
  postMessage: (call: WorkerConvertMethod["call"]) => void
}

type InferWorker = Omit<Worker, "postMessage"> & {
  postMessage: (call: WorkerInferMethod["call"]) => void
}

type ValidModelWorker = Omit<Worker, "postMessage"> & {
  postMessage: (call: WorkerCheckValidModel["call"]) => void
}

export class API {
  static async convertToMp4(
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
    onProgress: (progress: FileTreeLeaf["progress"]) => void
  ): Promise<void> {
    const {promise, resolve, reject} = promiseWithResolve<void>()
    const workerUrl = document.body.dataset.workerUrl as string
    const worker = new Worker(workerUrl, {name: "convertor"}) as ConvertWorker
    worker.addEventListener("message", e => {
      const data = e.data as WorkerConvertMethod["message"]
      switch (data.type) {
        case "progress":
          onProgress(data.progress)
          break
        case "done":
          resolve();
          break
        case "error":
          reject(data.error)
          break
        default:
          exhausted(data)
      }
    })
    worker.postMessage({method: "convert", input, output})
    return promise
  }

  static inferVideo(
    yoloSettings: YoloSettings | null,
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
    onProgress: (progress: FileTreeLeaf["progress"]) => void,
  ): Promise<void> {
    const {promise, resolve, reject} = promiseWithResolve<void>()
    const workerUrl = document.body.dataset.workerUrl as string
    const worker = new Worker(workerUrl, {name: "inferrer"}) as InferWorker
    worker.addEventListener("message", e => {
      const data = e.data as WorkerConvertMethod["message"]
      switch (data.type) {
        case "progress":
          onProgress(data.progress)
          break
        case "done":
          resolve();
          break
        case "error":
          reject(data.error)
          break
        default:
          exhausted(data)
      }
    })
    worker.postMessage({method: "infer", yoloSettings, input, output})
    return promise
  }

  static checkValidModel(
    yoloBackend: YoloBackend,
    directory: FileSystemDirectoryHandle,
  ): Promise<{name: string}> {
    const {promise, resolve, reject} = promiseWithResolve<{name: string}>()
    const workerUrl = document.body.dataset.workerUrl as string
    const worker = new Worker(workerUrl, {name: "checkValidModel"}) as ValidModelWorker
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
}
self.postMessage("ready")
