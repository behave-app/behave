import { FunctionComponent, JSX } from "preact"
import * as css from "./modalpopup.module.css"

export type ButtonInfo = {
  name: string
}


type Props = {
  children: string | JSX.Element | JSX.Element[]
  addOkButtonCallback?: () => void
}

export const ModalPopup: FunctionComponent<Props> = ({
  children,
  addOkButtonCallback,
}) => {
  return <div className={css.background}>
    <div className={css.popup}>
      <div>{children}</div>
      {addOkButtonCallback !== undefined &&
        <button onClick={addOkButtonCallback}>OK</button>}
    </div>
  </div>

}
