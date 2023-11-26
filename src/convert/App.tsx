import { render } from "preact"

import {Convertor} from "./Convertor.js"

export function App(_props: {}) {
  return <div><Convertor /></div>
}

render(<App />, document.body)
