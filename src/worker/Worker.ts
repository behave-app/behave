import { convert, extractMetadata } from "./video"
import { exhausted } from "../lib/util"
import { WorkerMethod, WorkerConvertMethod, WorkerInferMethod, WorkerAutoConfigureAndTestModel, WorkerExtractMetadata, WorkerCheckValidModel, WorkerTestModel } from "./Api"
import { getModel, autoConfigureAndTestModel, getModelAndInfer, testModel} from "./infer"
import { getSavedModelFileHandleFromName } from "../lib/tfjs-shared"



self.addEventListener("message", e => {
  const data = e.data as WorkerMethod["call"]
  switch (data.method) {
    case "convert": {
      const reply = (message: WorkerConvertMethod["message"]) => {
        self.postMessage(message)
      }
      let hasError = false
      convert(data.input, data.output, data.forceOverwrite, progress => {
        reply({type: "progress", progress})
      }).then(() => {
          reply({type: "done"})
        }).catch((error) => {
          hasError = true
          reply({type: "progress", progress: {error: `${error}`}})
          reply({type: "error", error})
          console.error(error)
          throw error
        }).finally(() => {
          if (!(hasError && data.keepAliveOnError)) {
            self.close()
          }
        })
    }
      break
    case "infer": {
      const reply = (message: WorkerInferMethod["message"]) => {
        self.postMessage(message)
      }
      let hasError = false
      getModelAndInfer(data.yoloSettings, data.input, data.output, data.forceOverwrite, progress => {
        reply({type: "progress", progress})
      }).then(() => {
          reply({type: "done"})
        }).catch((error) => {
          hasError = true
          reply({type: "progress", progress: {error: `${error}`}})
          reply({type: "error", error})
          console.error(error)
          throw error
        }).finally(() => {
          if (!(hasError && data.keepAliveOnError)) {
            self.close()
          }
        })
    }
      break
    case "check_valid_model": {
      const reply = (message: WorkerCheckValidModel["message"]) => {
        self.postMessage(message)
      }
      let hasError = false
      getSavedModelFileHandleFromName(data.yoloSettings.modelFilename)
      .then(fileHandle => getModel(
          fileHandle, data.yoloSettings.backend, data.yoloSettings.needsNms))
      .then((model) => {
          reply({type: "done", result: {name: model.name}})
        }).catch(error => {
          hasError = true
          console.warn(error)
          reply({type: "error", error})
        }).finally(() => {
          if (!(hasError && data.keepAliveOnError)) {
            self.close()
          }
        })
    }
      break
    case "auto_configure_and_test_model": {
      const reply = (message: WorkerAutoConfigureAndTestModel["message"]) => {
        self.postMessage(message)
      }
      let hasError = false
      autoConfigureAndTestModel(data.modelFile, progress =>
        reply({type: "progress", progress}))
      .then((result) => {
          reply({type: "done", result})
        }).catch(error => {
          hasError = true
          console.warn(error)
          reply({type: "error", error})
        }).finally(() => {
          if (!(hasError && data.keepAliveOnError)) {
            self.close()
          }
        })
    }
      break
    case "test_model": {
      const reply = (message: WorkerTestModel["message"]) => {
        self.postMessage(message)
      }
      let hasError = false
      testModel(data.modelFile, data.backend, data.needsNms, progress =>
        reply({type: "progress", progress}))
      .then((result) => {
          reply({type: "done", result})
        }).catch(error => {
          hasError = true
          console.warn(error)
          reply({type: "error", error})
        }).finally(() => {
          if (!(hasError && data.keepAliveOnError)) {
            self.close()
          }
        })
    }
      break
    case "extract_metadata": {
      const reply = (message: WorkerExtractMetadata["message"]) => {
        self.postMessage(message)
      }
      let hasError = false
      extractMetadata(data.file).then(
        result => reply({type: "done", result})
      ).catch(error => {
          hasError = true
          console.warn(error)
          reply({type: "error", error})
        }).finally(() => {
          if (!(hasError && data.keepAliveOnError)) {
            self.close()
          }
        })
    }
      break
    default:
      exhausted(data)
  }
})
console.log("Worker listening")
