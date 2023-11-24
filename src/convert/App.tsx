import { render } from "preact"

import {Upload} from "./Upload.js"

export function App(_props: {}) {
  return <div><Upload/></div>
}

render(<App />, document.body)
