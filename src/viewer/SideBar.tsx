import { FunctionComponent } from "preact"
import * as viewercss from "./viewer.module.css"
import * as css from "./sidebar.module.css"
import { useSelector } from "react-redux"
import {SidebarPopup, selectSidebarPopup} from "./appSlice"
import { Button } from "./PlayerInfo"
import { CONTROLS } from "./controls"
import { ClassSliders } from "./ClassSliders"
import { Info } from "./Info"


export const SideBar: FunctionComponent = () => {
  const popup = useSelector(selectSidebarPopup)
  return <div className={[viewercss.sidebar, css.sidebar,].join(" ")}>
    {popup && <Popup popup={popup} />}
    <div className={css.sidebar_buttons}>
      <Button controlInfo={CONTROLS.showInfo} />
      <Button controlInfo={CONTROLS.show_controls} />
      <Button controlInfo={CONTROLS.classSliders} />
      <Button controlInfo={CONTROLS.showSettings} />
    </div>
  </div>
}

const Popup: FunctionComponent<{popup: SidebarPopup}> = ({popup}) => {
  return <div class={css.popup}>{(() => {
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
  </div>
}
