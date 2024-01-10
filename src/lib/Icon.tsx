import { FunctionComponent, ComponentProps, h } from "preact"

const ICONS = {
  settings: "\ue8b8",
  play_pause: "\uf127",
  delete: "\ue872",
} as const

export type ValidIconName = keyof typeof ICONS

type ButtonProps = {
  type: "button"
} & ComponentProps<"button">

type SpanProps = {
  type?: "span"
} & ComponentProps<"span">

type Props = {
  iconName: ValidIconName | ValidIconName[]
} & (
  ButtonProps | SpanProps
)

export const Icon: FunctionComponent<Props> = ({type, iconName, ...props}) => {
  const iconNames = (typeof iconName === "string") ? [iconName] : iconName
  props.className = "material-symbols-outlined" + ("className" in props ? " " + props.className : "")
  return h(type ?? "span", props, iconNames.map(iconName => ICONS[iconName]).join(""))
}
