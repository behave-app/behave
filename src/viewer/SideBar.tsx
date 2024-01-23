import { FunctionComponent } from "preact"
import { Icon } from "../lib/Icon"
import * as viewercss from "./viewer.module.css"
import * as css from "./sidebar.module.css"
import { useDispatch } from "react-redux"
import {settingsScreenShown} from "./appSlice"

export const SideBar: FunctionComponent = () => {
  const dispatch = useDispatch()
  return <div className={[viewercss.sidebar, css.sidebar,].join(" ")}>
    <button className={[css.button, css.settings].join(" ")} onClick={() => dispatch(settingsScreenShown())}>
      <Icon iconName="settings" />
    </button>
  </div>
}
