import "preact/debug"
import { render } from 'preact';
import { Provider } from 'react-redux';
import store from './store';
import { App } from './App.js';

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.body);

