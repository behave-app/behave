export const EXTENSIONS = {
  detectionFile: ".behave.det.json",
  videoFile: ".behave.mp4",
  videoFileMp4: ".mp4",
  behaviourFile: ".behave.csv",
  videoSourceMp4: ".mp4",
  videoSourceMts: ".mts",
  notVideoSource: ".behave.mp4"
} as const
const hash = "[0-9a-f]{16}"
export const EXTENSIONSMATCH = {
  detectionFile: new RegExp(
    `${EXTENSIONS.detectionFile.replace(".", "\\.")}$`, "i"),
  videoFile: new RegExp(`${EXTENSIONS.videoFile.replace(".", "\\.")}$`, "i"),
  videoFileMp4: new RegExp(`${EXTENSIONS.videoFileMp4.replace(".", "\\.")}$`, "i"),
  behaviourFile: new RegExp(
    `${EXTENSIONS.behaviourFile.replace(".", "\\.")}$`, "i"),
  videoSourceMp4: new RegExp(
    `${EXTENSIONS.videoSourceMp4.replace(".", "\\.")}$`, "i"),
  videoSourceMts: new RegExp(
    `${EXTENSIONS.videoSourceMts.replace(".", "\\.")}$`, "i"),
  notVideoSource: new RegExp(
    `\\.${hash}${EXTENSIONS.notVideoSource.replace(".", "\\.")}$`, "i"),
} as const
