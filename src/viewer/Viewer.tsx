import { FunctionComponent } from "preact"
import * as css from "./viewer.module.css"
import { useAppDispatch, RootState } from './store';
import { useSelector } from 'react-redux';
import { selectVideoFileIsReady, selectVideoFile } from "./videoFileSlice.js";
import { selectMainWindow, MainWindow } from "./appSlice.js";
import { FileSelector } from "./FileSelector.js"


const VideoViewer: FunctionComponent = () => {
  const videoFile = useSelector(selectVideoFile)

  return <div>Video: {videoFile.file.name} ({videoFile.xxh64sum})</div>
}

const MAIN_WINDOW_MAP: {[key in MainWindow]: FunctionComponent<{}>} = {
  FileSelector,
  VideoViewer,
} as const

export const Viewer: FunctionComponent = () => {
  const dispatch = useAppDispatch();
  const windowToShow : MainWindow = useSelector((state: RootState) => {
    if (!selectVideoFileIsReady(state)) {
      return "FileSelector"
    }
    return selectMainWindow(state)
  })

  const MainWindowElement = MAIN_WINDOW_MAP[windowToShow]

  return <div className={css.test}>
    <MainWindowElement />
  </div>
}
