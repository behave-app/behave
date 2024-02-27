import { FunctionComponent } from "preact"
import { useSelector } from "react-redux"
import { behaviourBarSizeSet, behaviourBarToggled, controlPaneToggled, detectionBarSizeSet, detectionBarToggled, selectBehaviourBarShown, selectBehaviourBarSize, selectControlPanelShown, selectDetectionBarShown, selectDetectionBarSize } from "./generalSettingsSlice"
import { useAppDispatch } from "./store"
import { Icon } from "../lib/Icon"
import * as css from "./sizer.module.css"

export const Sizer: FunctionComponent = () => {
  const controlPaneShown = useSelector(selectControlPanelShown)
  const detectionBarShown = useSelector(selectDetectionBarShown)
  const detectionBarSize = useSelector(selectDetectionBarSize)
  const behaviourBarShown = useSelector(selectBehaviourBarShown)
  const behaviourBarSize = useSelector(selectBehaviourBarSize)
  const dispatch = useAppDispatch()
  return <div>
    <h3>control panel</h3>
    <div>
      <div className={css.on_off} onClick={() => dispatch(controlPaneToggled())}>
      <Icon iconName={controlPaneShown ? "check_box" : "check_box_outline_blank"}
        /> visible
      </div>
    </div>
    <h3>detection bar</h3>
    <div>
      <div className={css.on_off} onClick={() => dispatch(detectionBarToggled())}>
      <Icon iconName={detectionBarShown ? "check_box" : "check_box_outline_blank"}
        /> visible
      </div>
      <input type="range" min={5} max={45} disabled={!detectionBarShown}
        className={css.slider} value={detectionBarSize} onChange={
          e => dispatch(detectionBarSizeSet(e.currentTarget.valueAsNumber))}/>
    </div>
    <h3>behaviour bar</h3>
    <div>
      <div className={css.on_off} onClick={() => dispatch(behaviourBarToggled())}>
      <Icon iconName={behaviourBarShown ? "check_box" : "check_box_outline_blank"}
        /> visible
      </div>
      <input type="range" min={5} max={45} disabled={!behaviourBarShown}
        className={css.slider} value={behaviourBarSize} onChange={
          e => dispatch(behaviourBarSizeSet(e.currentTarget.valueAsNumber))}/>
    </div>
    
  </div>
}

