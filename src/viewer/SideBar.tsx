import { FunctionComponent } from "preact"
import * as viewercss from "./viewer.module.css"
import * as css from "./sidebar.module.css"
import { Button } from "./Button"
import { CONTROLS } from "./controls"

export const SideBar: FunctionComponent = () => {
  return <div className={[viewercss.sidebar, css.sidebar,].join(" ")}>
    <div className={css.sidebar_buttons}>
      <Button controlInfo={CONTROLS.show_info} />
      <Button controlInfo={CONTROLS.show_controls} />
      <Button controlInfo={CONTROLS.class_sliders} />
      <Button controlInfo={CONTROLS.show_settings} />
      <Button controlInfo={CONTROLS.key_shortcut_help_toggle} />
    </div>
  </div>
}
