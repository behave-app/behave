import { FunctionComponent } from "preact"
import * as css from "./modalpopup.module.css"

export type ButtonInfo = {
  name: string
}


type Props<K extends ButtonInfo[] = {name: "OK"}[]> = {
  message: string,
  buttonInfos?: K,
  callback: (pressedButton: K[number]) => void
}

export const ModalPopup: FunctionComponent<Props> = ({
  message,
  buttonInfos,
  callback,
}) => {
  buttonInfos = buttonInfos ?? [{name: "OK"}]
  return <div className={css.background}>
    <div className={css.popup}>
      <div>{message}</div>
      {buttonInfos.map(bi =>
        <button onClick={() => callback(bi)}>{bi.name}</button>
        )}
    </div>
  </div>

}
