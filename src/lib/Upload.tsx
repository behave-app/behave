import * as css from './upload.module.css'
import {useRef, useState, useLayoutEffect} from 'preact/hooks'
import { JSX } from "preact"
import { Icon } from './Icon'

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

  useLayoutEffect(() => {
    const aimedAt = window.document.documentElement
    const dragEnter = (_event: DragEvent) => {
      dragCounter.current += 1
      setDragState("dragging")
    }
    const dragDrop = async (event: DragEvent) => {
      dragCounter.current -= 1
      event.preventDefault()
      if (event.dataTransfer !== null) {
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
  return <>
    {dragState === "dragging" && <div className={css.fullScreenDropInfo}>
      <Icon iconName="place_item" />
      <div>Drop files here</div>
    </div>}
  </>
}
