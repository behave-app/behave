import { render } from "preact"

import {Inferrer} from "./Inferrer.js"

export function App() {
  return <div><Inferrer /></div>
}

render(<App />, document.body)
