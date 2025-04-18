declare const WORKER_URL: string;

import { exhausted, promiseWithResolve} from "../lib/util"
import {FileTreeLeaf} from "../lib/FileTree"
import { YoloSettings, YoloBackend } from "../lib/tfjs-shared"
import { VideoMetadata } from "../lib/video-shared"
import { tic } from "../lib/insight";

export type WorkerMethod = WorkerConvertMethod | WorkerInferMethod | WorkerCheckValidModel | WorkerAutoConfigureAndTestModel | WorkerExtractMetadata | WorkerTestModel

export type WorkerConvertMethod = {
  call: {
    method: "convert",
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
    forceOverwrite: boolean,
    keepAliveOnError: boolean,
  }
  message: {type: "progress", progress: FileTreeLeaf["progress"]}
  | {type: "done"}
  | {type: "error", error: Error}
}

export type WorkerInferMethod = {
  call: {
    method: "infer",
    yoloSettings: YoloSettings
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
    forceOverwrite: boolean,
    keepAliveOnError: boolean,
  }
  message: {type: "progress", progress: FileTreeLeaf["progress"]}
  | {type: "done"}
  | {type: "error", error: Error}
}

export type WorkerCheckValidModel = {
  call: {
    method: "check_valid_model",
    yoloSettings: YoloSettings,
    keepAliveOnError: boolean,
  }
  message: {type: "done", result: {name: string}}
  | {type: "error", error: Error}
}

export type AutoConfigureAndTestModelDone = {performance: {[k in YoloBackend]: {msPerInfer: number} | {"error": Error}}, modelNeedsNms: boolean}

export type WorkerAutoConfigureAndTestModel = {
  call: {
    method: "auto_configure_and_test_model",
    modelFile: FileSystemFileHandle,
    keepAliveOnError: boolean,
  }
  message: {type: "progress", progress: number}
  | {type: "done", result: AutoConfigureAndTestModelDone}
  | {type: "error", error: Error}
}

export type TestModelDone = AutoConfigureAndTestModelDone["performance"][YoloBackend]
export type WorkerTestModel = {
  call: {
    method: "test_model",
    modelFile: FileSystemFileHandle,
    backend: YoloBackend,
    needsNms: boolean,
    keepAliveOnError: boolean,
  }
  message: {type: "progress", progress: number}
  | {type: "done", result: TestModelDone}
  | {type: "error", error: Error}
}

export type WorkerExtractMetadata = {
  call: {
    method: "extract_metadata",
    file: File,
    keepAliveOnError: boolean,
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
type AutoConfigureAndTestModelWorker = LimitedWorker<WorkerAutoConfigureAndTestModel>
type TestModelWorker = LimitedWorker<WorkerTestModel>
type ExtractMetadataWorker = LimitedWorker<WorkerExtractMetadata>

const keepAliveOnError = new URL(document.location.href).searchParams.get("keepAliveOnError") !== null

export class API {
  static async convertToMp4(
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
    forceOverwrite: boolean,
    onProgress: (progress: FileTreeLeaf["progress"]) => void
  ): Promise<void> {
    const {promise, resolve, reject} = promiseWithResolve<void>()
    const worker = new Worker(WORKER_URL, {name: "convertor", type: "module"}) as ConvertWorker
    worker.addEventListener("message", e => {
      const data = e.data as WorkerConvertMethod["message"]
      switch (data.type) {
        case "progress":
          onProgress(data.progress)
          break
        case "done":
          tic(input.file, "convert-done", {})
          resolve();
          break
        case "error":
          reject(data.error)
          break
        default:
          exhausted(data)
      }
    })
    worker.postMessage({method: "convert", input, output, forceOverwrite, keepAliveOnError})
    return promise
  }

  static inferVideo(
    yoloSettings: YoloSettings,
    input: {file: File},
    output: {dir: FileSystemDirectoryHandle},
    forceOverwrite: boolean,
    onProgress: (progress: FileTreeLeaf["progress"]) => void,
  ): Promise<void> {
    const {promise, resolve, reject} = promiseWithResolve<void>()
    const worker = new Worker(WORKER_URL, {name: "inferrer", type: "module"}) as InferWorker
    worker.addEventListener("message", e => {
      const data = e.data as WorkerConvertMethod["message"]
      switch (data.type) {
        case "progress":
          onProgress(data.progress)
          break
        case "done":
          tic(input.file, "infer-done", {backend: yoloSettings.backend})
          resolve();
          break
        case "error":
          reject(data.error)
          break
        default:
          exhausted(data)
      }
    })
    worker.postMessage({method: "infer", yoloSettings, input, output, forceOverwrite, keepAliveOnError})
    return promise
  }

  static checkValidModel(
    yoloSettings: YoloSettings,
  ): Promise<{name: string}> {
    const {promise, resolve, reject} = promiseWithResolve<{name: string}>()
    const worker = new Worker(WORKER_URL, {name: "checkValidModel", type: "module"}) as ValidModelWorker
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
    worker.postMessage({method: "check_valid_model", yoloSettings, keepAliveOnError})
    return promise
  }
  static autoConfigureAndTestModel(
    modelFile: FileSystemFileHandle,
    progress: (progress: number) => void,
  ): Promise<AutoConfigureAndTestModelDone> {
    const {promise, resolve, reject} = promiseWithResolve<AutoConfigureAndTestModelDone>()
    const worker = new Worker(WORKER_URL, {name: "autoConfigureAndTestModel", type: "module"}) as AutoConfigureAndTestModelWorker
    worker.addEventListener("message", e => {
      const data = e.data as WorkerAutoConfigureAndTestModel["message"]
      switch (data.type) {
        case "progress":
          progress(data.progress)
          break
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
    worker.postMessage({method: "auto_configure_and_test_model", modelFile, keepAliveOnError})
    return promise
  }

  static testModel(
    modelFile: FileSystemFileHandle,
    backend: YoloBackend,
    needsNms: boolean,
    progress: (progress: number) => void,
  ): Promise<TestModelDone> {
    const {promise, resolve, reject} = promiseWithResolve<TestModelDone>()
    const worker = new Worker(WORKER_URL, {name: "testModel", type: "module"}) as TestModelWorker
    worker.addEventListener("message", e => {
      const data = e.data as WorkerTestModel["message"]
      switch (data.type) {
        case "progress":
          progress(data.progress)
          break
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
    worker.postMessage({method: "test_model", modelFile, backend, needsNms, keepAliveOnError})
    return promise
  }

  static extractMetadata(
    file: File,
  ): Promise<VideoMetadata> {
    const {promise, resolve, reject} = promiseWithResolve<VideoMetadata>()
    const worker = new Worker(WORKER_URL, {name: "extractMetadata", type: "module"}) as ExtractMetadataWorker
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
    worker.postMessage({method: "extract_metadata", file, keepAliveOnError})
    return promise
  }
}
self.postMessage("ready")
