import {Upload} from "./Upload.js"
import {FileTree, FileTreeBranch, FileTreeLeaf} from "./FileTree.js"
import * as css from "./convertor.module.css"
import { JSX } from "preact"
import {useState} from 'preact/hooks'
import {convert, getOutputFilename} from "./ffmpeg.js"

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
  return new Map(
    [...result.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, {numeric: true})))
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

function updateLeaf(files: FileTreeBranch, path: string[], update: FileTreeLeaf | ((current: FileTreeLeaf) => FileTreeLeaf)): FileTreeBranch {
  const newFiles = new Map([...files])
  const [p, ...restpath] = path
  const item = files.get(p)
  let newItem: FileTreeLeaf | FileTreeBranch
  if (restpath.length === 0) {
    if (!(item && "file" in item)) {
      throw new Error(`Error in path: $(path}`)
    }
    if ("file" in update) {
      newItem = update;
    } else {
      newItem = update(item)
    }
  } else {
    if (!(item instanceof Map)) {
      throw new Error(`Error in path: $(path}`)
    }
    newItem = updateLeaf(item, restpath, update)
  }
  newFiles.set(p, newItem)
  return newFiles
}

function findLeaf(files: FileTreeBranch, path: string[]): FileTreeLeaf {
  const [p, ...restpath] = path
  const item = files.get(p)
  if (restpath.length === 0) {
    if (!(item && "file" in item)) {
      throw new Error(`Error in path: $(path}`)
    }
    return item
  }
  if (!(item instanceof Map)) {
    throw new Error(`Error in path: $(path}`)
  }
  return findLeaf(item, restpath)
}

function getAllLeafPaths(files: FileTreeBranch): string[][] {
  return [...files.entries()]
    .flatMap(([name, entry]) =>
    (entry instanceof Map)
      ? getAllLeafPaths(entry).map(path => [name, ...path])
        : [[name]])
}

async function convertOne(
  files: FileTreeBranch,
  path: string[],
  destination: FileSystemDirectoryHandle,
  setFiles: (cb: (files: FileTreeBranch) => FileTreeBranch) => void
) {
  const leaf = findLeaf(files, path)
  let pointer = destination
  for (const p of path.slice(0, -1)) {
    //probably should catch if there is a file with this directoy name //TODO
    pointer = await pointer.getDirectoryHandle(p, {create: true})
  }
  const outfilename = getOutputFilename(leaf.file.name)
  try {
    // Try to open to catch case that file was created since initial check
    await pointer.getFileHandle(outfilename)
    setFiles(files => updateLeaf(files, path, leaf => (
      {file: leaf.file, progress: {"error": "File aready exists at the destination"}})))
    return
  } catch (e) {
    if ((e as DOMException).name === "NotFoundError") {
      // expected
    } else {
      throw e;
    }
  }
  const outfile = await pointer.getFileHandle(outfilename, {create: true})
  const outstream = await outfile.createWritable()
  try {
    await convert(leaf.file, outstream, (progress: FileTreeLeaf["progress"]) => {
      setFiles(files =>
        updateLeaf(files, path, leaf => ({file: leaf.file, progress})))
    })
    outstream.close()
  } catch (e) {
    outstream.close()
    pointer.removeEntry(outfilename)
  }
}

async function convertAll(files: FileTreeBranch, setFiles: (cb: FileTreeBranch | ((files: FileTreeBranch) => FileTreeBranch)) => void) {
  const destination = await window.showDirectoryPicker(
    {id: "mp4save", mode: "readwrite"})
  const outputFiles = (await readFileSystemHandle([destination])).get(
    destination.name) as FileTreeBranch
  
  const paths = getAllLeafPaths(files)
  let newFiles = files
  for (const path of paths) {
    const outpath = [...path.slice(0, -1), getOutputFilename(path.slice(-1)[0])]
    try {
      findLeaf(outputFiles, outpath)
      newFiles = updateLeaf(
        newFiles, path, leaf => ({file: leaf.file, progress: {"error": "File aready exists at the destination"}}))
    } catch (e) {
      newFiles = updateLeaf(
        newFiles, path, leaf => ({file: leaf.file, progress: "queue"}))
    }
  }
  setFiles(newFiles)

  const promises: Set<Promise<any>> = new Set()
  let finished: Promise<any>[] = []
  for (const path of paths) {
    while (promises.size >= 4) {
      await Promise.any(promises)
      console.log("done promise.any")
      finished.forEach(p => promises.delete(p))
      finished = []
    }
    const promise = convertOne(files, path, destination, setFiles)
    promises.add(promise)
    promise.then(() => finished.push(promise))
  }
  await Promise.all(promises)
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
    <button disabled={!(state==="uploading" && files.size > 0)}
      onClick={() => {setState("converting"); convertAll(files, setFiles).then(() => setState("done"))}}
      >Start conversion</button>
  </>
}

