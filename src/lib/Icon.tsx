import { FunctionComponent } from "preact"
import * as css from "./icon.module.css"

const ICONS = {
  settings: "\ue8b8",
  play_pause: "\uf127",
  delete: "\ue872",
  add: "\ue145",
  check_box_checked: "\ue834",
  check_box_unchecked: "\ue835",
  download: "\uf090",
  upload: "\uf09b",
} as const

export type ValidIconName = keyof typeof ICONS

type Props = {
  iconName: ValidIconName | ValidIconName[]
}

export const Icon: FunctionComponent<Props> = ({iconName}) => {
  const iconNames = (typeof iconName === "string") ? [iconName] : iconName
  return <span className={css.iconWrapper}><span className={css.icon}>{iconNames.map(iconName => ICONS[iconName]).join("")}</span></span>
}
