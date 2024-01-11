import { FunctionComponent, ComponentProps, h } from "preact"
import * as css from "./icon.module.css"

const ICONS = {
  settings: "\ue8b8",
  play_pause: "\uf127",
  delete: "\ue872",
} as const

export type ValidIconName = keyof typeof ICONS

type Props = {
  iconName: ValidIconName | ValidIconName[]
}

export const Icon: FunctionComponent<Props> = ({iconName}) => {
  const iconNames = (typeof iconName === "string") ? [iconName] : iconName
  return <span className={css.iconWrapper}><span className={css.icon}>{iconNames.map(iconName => ICONS[iconName]).join("")}</span></span>
}
