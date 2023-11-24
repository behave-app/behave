import {useState, useEffect} from 'preact/hooks'
import { JSX } from "preact"

export function Upload(_props: {}): JSX.Element {
  type DragState = "nodrag" | "dragging" | "error"
  const [dragState, setDragState] = useState<DragState>("nodrag")
  console.log(dragState)
  useEffect(() => {
    const dragEnter = () => {
      setDragState("dragging")
    }
    const dragDrop = (event: DragEvent) => {
      event.preventDefault()
      console.log([...event.dataTransfer!.items])
    }
    const dragLeave = (event: DragEvent) => {
      setDragState("nodrag")
    }
    const dragOver = (event: DragEvent) => {
      event.preventDefault()
    }
    window.document.addEventListener("dragenter", dragEnter)
    window.document.addEventListener("dragleave", dragLeave)
    window.document.addEventListener("dragover", dragOver)
    window.document.addEventListener("drop", dragDrop)
    return () => {
      window.document.removeEventListener("dragenter", dragEnter)
      window.document.removeEventListener("dragleave", dragLeave)
      window.document.removeEventListener("dragover", dragOver)
      window.document.removeEventListener("drop", dragDrop)
    }
  }, [])
  switch (dragState) {
    case "nodrag":
      return <div>Drag one or more video files here to start conversion to mp4.</div>
    case "dragging":
      return <div>Drop the video files here</div>
    case "error":
      return <div>There was an error with the files, please reload</div>
  }
}
