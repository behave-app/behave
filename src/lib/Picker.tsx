import { ComponentChildren, FunctionComponent } from "preact"
import { TSAssertType, assert, joinedStringFromDict } from "./util"
import { useEffect, useRef, useState } from "react"
import * as css from "./picker.module.css"

type Props<T> = {
  value: T
  onChange: (newValue: T) => void
  nrColumns: number
  children: ComponentChildren
}

export function Picker<T>(
  {value, nrColumns, onChange, children: childOrChildren}: Props<T>
): ReturnType<FunctionComponent<Props<T>>> {
  const children = [childOrChildren].flat(Infinity)
  assert(children.every(child => child && typeof(child) === "object" && "props" in child && "data-value" in child.props))
  TSAssertType<{props: {"data-value": T}}[]>(children)
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.stopPropagation()
        setIsOpen(false);
      }
    }
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => document.documentElement.removeEventListener("keydown", onKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (!dialogRef.current) {
      return
    }
    if (isOpen) {
      dialogRef.current.showModal()
    } else {
      dialogRef.current.close()
    }
  }, [isOpen])

  return <div class={css.picker}>
    <dialog ref={dialogRef} style={{"--number-of-columns": nrColumns}}>
      <div className={css.open}>
        {children.map(child => {
          const selected = child.props["data-value"] === value
          return <button onClick={() => {
            setIsOpen(false);
            if (!selected) {
              onChange(child.props["data-value"])
            }
          }} className={joinedStringFromDict({
              "picker_opened": true,
              [css.selected]: selected
            })}>
            {child}
          </button>
        })}
      </div>
    </dialog>
    <button className={joinedStringFromDict({
      [css.closed]: true,
      "picker_closed": true})
    } onClick={() => setIsOpen(open => !open)}>
      {children.filter(child => child.props["data-value"] === value)}
    </button>
  </div>

}
