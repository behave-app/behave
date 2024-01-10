import { FunctionComponent } from "preact"
import * as css from "./settings.module.css"
import { useDispatch } from "react-redux"
import { settingsScreenHidden } from "./appSlice.js"

export const Settings: FunctionComponent = () => {
  const dispatch = useDispatch()
  return <div className={css.background}>
    <div className={css.popup}>
      <h1>Settings</h1>
      <button onClick={() => dispatch(settingsScreenHidden())}>close</button>
    </div>
  </div>

}
