import { FunctionComponent } from "preact"
import * as viewercss from "./viewer.module.css"
import * as css from "./sidebar.module.css"
import { Button } from "./Button"
import { CONTROLS } from "./controls"

export const SideBar: FunctionComponent = () => {
  return <div className={[viewercss.sidebar, css.sidebar,].join(" ")}>
    <div className={css.top_bottom_buttons}>
      <div className={css.sidebar_buttons}>
        <Button controlInfo={CONTROLS.upload_files} />
        <Button controlInfo={CONTROLS.show_info} />
        <Button controlInfo={CONTROLS.class_sliders} />
        <Button controlInfo={CONTROLS.key_shortcut_help_toggle} />
        <Button controlInfo={CONTROLS.sizer} />
        <Button controlInfo={CONTROLS.fullscreen} />
      </div>
      <div className={css.sidebar_buttons}>
        <Button controlInfo={CONTROLS.show_controls} />
        <Button controlInfo={CONTROLS.show_detection_bar} />
        <Button controlInfo={CONTROLS.show_behaviour_bar} />
      </div>
    </div>
  </div>
}
