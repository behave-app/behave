import { FunctionComponent, JSX } from "preact"
import * as css from "./modalpopup.module.css"
import { useAppDispatch } from "../viewer/store"
import { useEffect } from "react"
import { modalPopupOpened } from "../viewer/appSlice"

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
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(modalPopupOpened())
    return () => {dispatch(modalPopupOpened())}
  }, [])

  return <div className={css.background}>
    <div className={css.popup}>
      <div>{children}</div>
      {addOkButtonCallback !== undefined &&
        <button onClick={addOkButtonCallback}>OK</button>}
    </div>
  </div>

}
