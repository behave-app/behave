import { ComponentChildren, FunctionComponent } from "preact"
import { TSAssertType, assert, joinedStringFromDict } from "./util"
import { useState } from "react"
import { Dialog } from "./Dialog"
import * as css from "./picker.module.css"

type Props<T> = {
  value: T
  equals?: (t1: T, t2: T) => boolean
  onChange: (newValue: T) => void
  nrColumns: number
  children: ComponentChildren
}

export function Picker<T>(
  {value, equals: equalsOrUndef, nrColumns, onChange, children: childOrChildren}: Props<T>
): ReturnType<FunctionComponent<Props<T>>> {
  const equals = equalsOrUndef ?? ((t1, t2) => t1 === t2)
  const children = [childOrChildren].flat(Infinity)
  assert(children.every(child => child !== null && typeof(child) === "object" && "props" in child && "data-value" in child.props))
  TSAssertType<{props: {"data-value": T}}[]>(children)
  const [isOpen, setIsOpen] = useState(false)

  return <div class={css.picker}>
    {isOpen && <Dialog onRequestClose={() => setIsOpen(false)} blur
      className={css.dialog} style={{"--number-of-columns": nrColumns}}>
      <div className={css.open}>
        {children.map(child => {
          const selected = equals(child.props["data-value"], value)
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
    </Dialog>}
    <button className={joinedStringFromDict({
      [css.closed]: true,
      "picker_closed": true})
    } onClick={() => setIsOpen(open => !open)}>
      {children.filter(child => equals(child.props["data-value"], value))}
    </button>
  </div>

}
