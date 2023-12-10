import { render } from "preact"

import {Debugger} from "./Debugger.js"

export function App() {
  return <div><Debugger /></div>
}

render(<App />, document.body)
