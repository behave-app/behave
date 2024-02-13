import { FunctionComponent } from "preact"
import { useSelector } from "react-redux"
import { selectVideoFilePotentiallyNull } from "./videoFileSlice"

export const Info: FunctionComponent = () => {
  const video = useSelector(selectVideoFilePotentiallyNull)
  return <>
    <h2>Behave version DEV</h2>
    <dl>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
      <dt>Video file</dt>
      <dd>{video ? video.file.name : "No video file loaded"}</dd>
    </dl>
    <div>TODO more info</div>
  </>
}
