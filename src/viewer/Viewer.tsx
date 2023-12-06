import { JSX } from "preact/jsx-runtime"
import * as css from "./viewer.module.css"
import { useAppDispatch, } from './store';
import { useSelector } from 'react-redux';
import { increment, decrement, incrementAsync, selectCount} from './reducer';

export const Viewer: preact.FunctionComponent = () => {
  const dispatch = useAppDispatch();
  const count = useSelector(selectCount)

  return <div className={css.test}>
    <h1>Counter: {count}</h1>
      <button onClick={() => dispatch(increment())}>Increment</button>
      <button onClick={() => dispatch(decrement())}>Decrement</button>
    <button onClick={() => dispatch(incrementAsync(7))}>Add Async</button>
  </div>
}
