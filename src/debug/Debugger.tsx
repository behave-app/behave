import { useEffect, useState } from "react"
import * as css from "./debugger.module.css"
import { asyncSleep } from "../lib/util";

async function isPrime(number: number): Promise<boolean> {
  if (number <= 1) return false; // Numbers less than 2 are not prime
  if (number === 2 || number === 3) return true; // 2 and 3 are prime numbers
  if (number % 2 === 0) return false; // All even numbers are not prime, except 2

  const sqrtN = Math.sqrt(number);
  for (let i = 3; i <= sqrtN; i += 2) { // Check only odd numbers starting from 3
    if (number % i === 0) return false;
 //   await asyncSleep(0)
  }

  return true;
}

let websocket: WebSocket

async function primeChecker(
  setResults: (cb: (res: string[]) => string[]) => void
): Promise<never> {
  while (true) {
    const lastStart = Date.now()
    setResults(res=> [...res, "0/0"])
    let iterations = 0
    let nrResults = 0
    while (nrResults < 20) {
      iterations++
      const nr = Math.floor((1 + Math.random()) * Math.pow(2, 47))
      if (await isPrime(nr)) {
        nrResults += 1;
      }
      const now = Date.now()
      await new Promise(res => res(1))
      setResults(res=> [...res.slice(0, -1),
        `${nrResults} primes in ${iterations} tries: ${((now - lastStart) / 1000).toFixed(1)} s`])
      document.title = `${iterations}`
    }
  await asyncSleep(1)
  }
}
 
export function Debugger2(): JSX.Element {
  const [results, setResults] = useState<string[]>([])

  useEffect(() => {
    void(primeChecker(setResults))
    document.addEventListener("freeze", () => {
      if (document.hidden) {
        setResults(r => [...r, "freeze", ""])
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        setResults(r => [...r, "hidden", ""])
      } else {
        setResults(r => [...r, "shown", ""])
      }
    });
    const wsUri = "wss://socketsbay.com/wss/v2/1/demo/";
    websocket = new WebSocket(wsUri);
    websocket.onopen = () => {console.log("ws open")}
    websocket.onclose = () => {console.log("ws close")}
    websocket.onerror = () => {console.log("ws error")}
    websocket.onmessage = e => {console.log(`ws message: ${e.data}`)}
  }
    ,[])

  return <>
    <h1>Welcome</h1>
    <ul className={css.list}>
    {results.map(res => <li>{res}</li>)}
  </ul>
  </>
}

let context: AudioContext

export function Debugger(): JSX.Element {
  const [results, setResults] = useState<string[]>([])

  const start = () => {
    void(primeChecker(setResults))
    document.addEventListener("freeze", () => {
      if (document.hidden) {
        setResults(r => [...r, "freeze", ""])
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        setResults(r => [...r, "hidden", ""])
      } else {
        setResults(r => [...r, "shown", ""])
      }

    });
    void(document.getElementsByTagName("audio")[0].play())
    return
      const lock = navigator.wakeLock.request("system").then((l) => {
      console.log("lock");
      return l
      }).catch((e: unknown) => console.log("error", e))

    return () => lock.then(l => l!.release()).then(() => console.log("released"))
  }

  return <>
    <h1>Welcome</h1>
    <audio
      src="https://github.com/anars/blank-audio/raw/master/5-minutes-of-silence.mp3"
      loop={true}
      controls={true}
      volume={1} />
    {results.length === 0 && <button onClick={start}>start</button>}
    <ul className={css.list}>
    {results.map(res => <li>{res}</li>)}
  </ul>
  </>
}

export function Debugger3(): JSX.Element {
  const [results, setResults] = useState<string[]>([])

  useEffect(() => {
    void(primeChecker(setResults))
    document.addEventListener("freeze", () => {
      if (document.hidden) {
        setResults(r => [...r, "freeze", ""])
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        setResults(r => [...r, "hidden", ""])
      } else {
        setResults(r => [...r, "shown", ""])
      }
    });
    context = new AudioContext()
  }
    ,[])

  return <>
    <h1>Welcome</h1>
    <ul className={css.list}>
    {results.map(res => <li>{res}</li>)}
  </ul>
  </>
}

