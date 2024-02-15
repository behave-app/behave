import { FunctionComponent } from "preact"
import * as viewercss from "./viewer.module.css"
import * as css from "./sidebar.module.css"
import { useSelector } from "react-redux"
import { selectSidebarPopup, sidebarPopupWasClosed} from "./appSlice"
import { Button } from "./Button"
import { CONTROLS } from "./controls"
import { ClassSliders } from "./ClassSliders"
import { Info } from "./Info"
import { Dialog } from "../lib/Dialog"
import { useAppDispatch } from "./store"


export const SideBar: FunctionComponent = () => {
  return <div className={[viewercss.sidebar, css.sidebar,].join(" ")}>
    <Popup />
    <div className={css.sidebar_buttons}>
      <Button controlInfo={CONTROLS.showInfo} />
      <Button controlInfo={CONTROLS.show_controls} />
      <Button controlInfo={CONTROLS.classSliders} />
      <Button controlInfo={CONTROLS.showSettings} />
    </div>
  </div>
}

const Popup: FunctionComponent = () => {
  const popup = useSelector(selectSidebarPopup)
  const dispatch = useAppDispatch()
  return popup && <Dialog onRequestClose={() => dispatch(sidebarPopupWasClosed())}>
    {(() => {
      switch (popup) {
        case "info":
          return <Info />
        case "classSliders":
          return <ClassSliders />
        default: {
          const exhaust: never = popup
          throw new Error(`Exhausted: ${exhaust}`)
        }
      }
    })()}
  </Dialog>
}
