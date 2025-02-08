import { FunctionComponent } from "preact"
import * as css from "./popups.module.css"
import * as generalcss from "./general.module.css"
import { Dialog } from "../lib/Dialog"
import { useState } from "preact/hooks"

type PromptProps = {
  title: string
  subtitle: string
  placeholder?: string
  value: string
  validator?: (s: string) => boolean | string
  ok: (s: string) => void,
  cancel: () => void,
}

export const Prompt: FunctionComponent<PromptProps> = ({title, subtitle, placeholder, value, validator, ok, cancel}) => {
  const [val, setVal] = useState(value)
  const validationResult = !validator || validator(val)
  const isValid = validationResult === true
  const validationError = typeof validationResult === "boolean" ? null : validationResult

  return <Dialog onRequestClose={cancel} className={css.prompt} blur>
    <h2>{title}</h2>
    <div>{subtitle}</div>
    <div className={css.validation_error}>{validationError}</div>
    <div>
      <input type="text" value={val} placeholder={placeholder}
        className={isValid ? css.text_valid : css.text_invalid}
        onKeyUp={e => {
        if (e.key === "Enter" && isValid) {
            ok(val)
        }}}
        onChange={e => setVal(e.currentTarget.value)} />
    </div>
    <div className={generalcss.button_row}>
      <button disabled={!isValid} onClick={() => ok(val)}>ok</button>
      <button onClick={cancel}>cancel</button>
    </div>
  </Dialog>
}

type ConfirmProps = {
  title: string
  subtitle: string
  yes: () => void,
  no: () => void,
}

export const Confirm: FunctionComponent<ConfirmProps> = ({title, subtitle, yes, no}) => {
  return <Dialog onRequestClose={no} className={css.confirm} blur>
    <h2>{title}</h2>
    <div>{subtitle}</div>
    <div className={generalcss.button_row}>
      <button onClick={yes}>yes</button>
      <button onClick={no}>no</button>
    </div>
  </Dialog>
}

type AlertProps = {
  title: string
  subtitle: string
  ok: () => void,
}

export const Alert: FunctionComponent<AlertProps> = ({title, subtitle, ok}) => {
  return <Dialog onRequestClose={ok} className={css.alert} blur>
    <h2>{title}</h2>
    <div>{subtitle}</div>
    <div className={generalcss.button_row}>
      <button onClick={ok}>ok</button>
    </div>
  </Dialog>
}
