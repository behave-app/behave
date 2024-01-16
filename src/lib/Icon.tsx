import { FunctionComponent } from "preact"
import * as css from "./icon.module.css"
import { ICONS } from "src/viewer/iconlist"

export type ValidIconName = typeof ICONS[number]

type Props = {
  iconName: ValidIconName | ValidIconName[]
}

export const Icon: FunctionComponent<Props> = ({iconName}) => {
  const iconNames = (typeof iconName === "string") ? [iconName] : iconName
  return <span className={css.iconWrapper}><span className={css.icon}>{
    iconNames.join("")
  }</span></span>
}

export {ICONS}
