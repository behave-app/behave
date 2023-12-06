import { render } from "preact"
import store from './store'
import { Provider } from "react-redux"
import {Viewer} from "./Viewer.js"

export function App(_props: {}) {
  return <Viewer />
}
