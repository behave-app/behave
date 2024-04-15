import { convert, extractMetadata } from "./video"
import { exhausted } from "../lib/util"
import { WorkerMethod, WorkerConvertMethod, WorkerInferMethod, WorkerCheckValidModel, WorkerExtractMetadata } from "./Api"
import { getModel, getModelAndInfer, setBackend, } from "./tfjs"



self.addEventListener("message", e => {
  const data = e.data as WorkerMethod["call"]
  switch (data.method) {
    case "convert": {
      const reply = (message: WorkerConvertMethod["message"]) => {
        self.postMessage(message)
      }
      convert(data.input, data.output, progress => {
        reply({type: "progress", progress})
      }).then(() => {
          reply({type: "done"})
        }).catch((error) => {
          reply({type: "progress", progress: {error: `${error}`}})
          reply({type: "error", error})
          console.error(error)
          throw error
        }).finally(() => {
          self.close()
        })
    }
      break
    case "infer": {
      const reply = (message: WorkerInferMethod["message"]) => {
        self.postMessage(message)
      }
      getModelAndInfer(data.yoloSettings, data.input, data.output, progress => {
        reply({type: "progress", progress})
      }).then(() => {
          reply({type: "done"})
        }).catch((error) => {
          reply({type: "progress", progress: {error: `${error}`}})
          reply({type: "error", error})
          console.error(error)
          throw error
        }).finally(() => {
          self.close()
        })
    }
      break
    case "check_valid_model": {
      const reply = (message: WorkerCheckValidModel["message"]) => {
        self.postMessage(message)
      }
      setBackend(data.backend).then(() =>
        getModel(data.directory)
      ).then((model) => {
          reply({type: "done", result: {name: model.name}})
        }).catch(error => {
          console.warn(error)
          reply({type: "error", error})
        }).finally(() => {
          self.close()
        })
    }
      break
    case "extract_metadata": {
      const reply = (message: WorkerExtractMetadata["message"]) => {
        self.postMessage(message)
      }
      extractMetadata(data.file).then(
        result => reply({type: "done", result})
      ).catch(error => {
          console.warn(error)
          reply({type: "error", error})
        }).finally(() => {
          self.close()
        })
    }
      break
    default:
      exhausted(data)
  }
})
console.log("Worker listening")
