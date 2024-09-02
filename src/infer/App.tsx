import { render } from "preact"

import {Inferrer} from "./Inferrer"

export function App() {
  return <div><Inferrer /></div>
}

render(<App />, document.querySelector("App")!)
