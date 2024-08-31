import * as css from './upload.module.css'
import {useRef, useState, useEffect} from 'preact/hooks'
import { JSX } from "preact"

type Props = {
  addFiles: (FileSystemHandles: FileSystemHandle[]) => Promise<void>
}

function filterNull<T>(arr: T[]): Exclude<T, null | undefined>[] {
  return arr.filter(x => !(x === null || x === undefined)) as Exclude<T, null | undefined>[]
}

export function Upload({addFiles}: Props): JSX.Element {
  type DragState = "nodrag" | "dragging"
  const [dragState, setDragState] = useState<DragState>("nodrag")
  const dragCounter = useRef(0)

  useEffect(() => {
    const aimedAt = window.document.querySelector("html")!
    const dragEnter = (_event: DragEvent) => {
      dragCounter.current += 1
      setDragState("dragging")
    }
    const dragDrop = async (event: DragEvent) => {
      dragCounter.current -= 1
      event.preventDefault()
      if (event.dataTransfer !== null) {
        console.log(event.dataTransfer.items[0], await event.dataTransfer.items[0].getAsFile())
        const fileSystemHandles = filterNull(await Promise.all(
          [...event.dataTransfer.items].map(dti => dti.getAsFileSystemHandle())))
        void(addFiles(fileSystemHandles))
      }
      setDragState("nodrag")
    }
    const dragLeave = (_event: DragEvent) => {
      dragCounter.current -= 1
      if (dragCounter.current > 0) {
        return;
      }
      console.log("leave")
      setDragState("nodrag")
    }
    const dragOver = (event: DragEvent) => {
      event.preventDefault()
    }
    aimedAt.addEventListener("dragenter", dragEnter)
    aimedAt.addEventListener("dragleave", dragLeave)
    aimedAt.addEventListener("dragover", dragOver)
    aimedAt.addEventListener("drop", dragDrop)
    return () => {
      aimedAt.removeEventListener("dragenter", dragEnter)
      aimedAt.removeEventListener("dragleave", dragLeave)
      aimedAt.removeEventListener("dragover", dragOver)
      aimedAt.removeEventListener("drop", dragDrop)
    }
  }, [])
  async function selectFilesToAdd() {
    const files = await window.showOpenFilePicker({multiple: true})
    void(addFiles(files))
  }
  return <>
    <div className={css.box}><button onClick={selectFilesToAdd}>Add files</button></div> 
    {dragState === "dragging" && <div className={css.fullScreenDropInfo}>Drop files here</div>}
  </>
}
