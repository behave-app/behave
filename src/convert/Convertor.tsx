import {Upload} from "./Upload.js"
import {FileTree, FileTreeBranch} from "./FileTree.js"
import * as css from "./convertor.module.css"
import { JSX } from "preact"
import {useState} from 'preact/hooks'

async function fromAsync<T>(source: Iterable<T> | AsyncIterable<T>): Promise<T[]> {
  const items:T[] = [];
  for await (const item of source) {
    items.push(item);
  }
  return items
}

async function readFileSystemHandle(fshs: FileSystemHandle[]): Promise<FileTreeBranch> {
  const result: FileTreeBranch = new Map()
  for (const fsh of fshs) {
    if (fsh instanceof FileSystemFileHandle) {
      const file = await fsh.getFile()
      if (fileFilter(file)) {
        result.set(fsh.name, {file: await fsh.getFile()})
      }
    } else if (fsh instanceof FileSystemDirectoryHandle) {
      result.set(fsh.name, await readFileSystemHandle(
        await fromAsync(fsh.values())))
    } else {
      throw new Error(`Unhandled case: ${fsh}`);
    }
  }
  pruneDeadBranches(result)
  return result;
}

function fileFilter(file: File): boolean {
  return !file.name.startsWith(".") && file.name.endsWith(".MTS")
}

function pruneDeadBranches(branch: FileTreeBranch) {
  for (const [name, entry] of branch.entries()) {
    if (entry instanceof Map) {
      pruneDeadBranches(entry)
      if (entry.size === 0) {
        branch.delete(name)
      }
    }
  }
}

export function Convertor({}: {}): JSX.Element {
  const [files, setFiles] = useState<FileTreeBranch>(new Map())
  const [state, setState] = useState<"uploading" | "converting" | "done">("uploading")

  async function addFiles(fileSystemHandles: FileSystemHandle[]) {
    const newFiles = await readFileSystemHandle(fileSystemHandles)
    setFiles(files => new Map([...files, ...newFiles]))
  }
  function removeFile(name: string[]) {
    setFiles(files => {
      const newFiles = new Map([...files])
      let pointer = newFiles
      for (const dir of name.slice(0, -1)) {
        if (!pointer.has(dir)) {
          throw new Error(`Could not find ${dir} (${name})`)
        }
        const newpointer = pointer.get(dir)!
        if (!(newpointer instanceof Map)) {
          throw new Error(`${dir} (${name}) is a File`)
        }
        const copieddir = new Map([...newpointer])
        pointer.set(dir, copieddir)
        pointer = copieddir
      }
      const [filename] = name.slice(-1)
      if (!pointer.has(filename)) {
        throw new Error (`Could not find ${filename} (${name})`)
      }
      pointer.delete(filename)
      pruneDeadBranches(newFiles)
      return newFiles
    })
  }

  return <>
    <h1>Video file convertor</h1>
    <div className={css.explanation}>
      This files converts video files to be used in BEHAVE. At the moment it can only convert MTS files, but it's easy to add additional types upon request.
    </div>
    <div className={css.files}>
    {files.size ? <FileTree {...{files, removeFile}} /> : "Add files to convert"}
    </div>
    {state === "uploading" && <Upload addFiles={addFiles} />}
    <button disabled={!(state==="uploading" && files.size > 0)}>Start conversion</button>
  </>
}

