import { render } from "preact"

import {Convertor} from "./Convertor"

export function App() {
  return <div><Convertor /></div>
}

render(<App />, document.querySelector("App")!)
