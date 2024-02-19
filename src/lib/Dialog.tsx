import { FunctionComponent } from "preact"
import { useEffect, useRef } from "react"
import { joinedStringFromDict } from "./util"
import * as css from "./dialog.module.css"
import { CSSProperties } from "preact/compat"

type Props = {
  onRequestClose: () => void
  className?: string
  style?: CSSProperties
  blur?: boolean
  type?: "error" | "normal"
}

export const Dialog: FunctionComponent<Props> = (
{onRequestClose: requestClose, type, children, blur, className, style}
) => {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!dialogRef.current) {
      return
    }
    const dialog = dialogRef.current
    const onClick = (event: MouseEvent) => {
      if (event.target !== event.currentTarget) {
        return
      }
      const inside = event.offsetX >= 0 && event.offsetX <= dialog.clientWidth
        && event.offsetY >= 0 && event.offsetY <= dialog.clientHeight
      if (!inside) {
        requestClose()
      }
    }
    const onClose = () => requestClose()
    dialog.addEventListener("click", onClick)
    dialog.addEventListener("close", onClose)
    return () => {
      dialog.removeEventListener("click", onClick)
      dialog.removeEventListener("close", onClose)
    }
  }, [dialogRef.current])

  useEffect(() => {
    if (!dialogRef.current) {
      return
    }
    dialogRef.current.showModal()
  }, [dialogRef.current])

  return <dialog ref={dialogRef} style={style} className={joinedStringFromDict({
    [css.dialog]: true,
    [css.blur]: !!blur,
    [css.error]: type === "error",
    [className ?? ""]: className !== undefined,
  })}>
  {children}
  </dialog>
}

