import "preact/debug"
import { render } from 'preact';
import { Provider } from 'react-redux';
import myStore from './store';
import { App } from './App';
import "./index.css"

render(
  <Provider store={myStore}>
    <App />
  </Provider>,
  document.querySelector("App")!)
