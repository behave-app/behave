import { render } from "preact"

import {Convertor} from "./Convertor.js"

export function App() {
  return <div><Convertor /></div>
}

render(<App />, document.body)
