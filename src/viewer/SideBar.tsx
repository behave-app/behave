import { FunctionComponent } from "preact"
import { Icon } from "../lib/Icon.js"
import * as viewercss from "./viewer.module.css"
import * as css from "./sidebar.module.css"
import { useDispatch } from "react-redux"
import {settingsScreenShown} from "./appSlice.js"

export const SideBar: FunctionComponent = () => {
  const dispatch = useDispatch()
  return <div className={[viewercss.sidebar, css.sidebar,].join(" ")}>
    <Icon type="button" className={[css.button, css.settings].join(" ")} iconName="settings" onClick={() => dispatch(settingsScreenShown())}/>
  </div>
}
