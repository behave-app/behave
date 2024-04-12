import * as css from "./filetree.module.css"
import { JSX } from "preact"
import { formatTime } from "./util";
import { CSSProperties } from "preact/compat";

export type ConvertAction = (
  input: {file: File},
  output: {dir: FileSystemDirectoryHandle},
  onProgress: (progress: FileTreeLeaf["progress"]) => void,
) => Promise<void>

async function fromAsync<T>(source: Iterable<T> | AsyncIterable<T>): Promise<T[]> {
  const items:T[] = [];
  for await (const item of source) {
    items.push(item);
  }
  return items
}

export async function readFileSystemHandle(
  fshs: FileSystemHandle[],
  fileFilter: (file: File) => boolean,
): Promise<[FileTreeBranch, ReadonlyArray<File>]> {
  const result: FileTreeBranch = new Map()
  const rejectedFiles: File[] = []
  for (const fsh of fshs) {
    if (fsh instanceof FileSystemFileHandle) {
      const file = await fsh.getFile()
      if (fileFilter(file)) {
        result.set(fsh.name, {file: await fsh.getFile()})
      } else {
        rejectedFiles.push(file)
      }
    } else if (fsh instanceof FileSystemDirectoryHandle) {
      const [subtree, subrejected] = await readFileSystemHandle(
        await fromAsync(fsh.values()), fileFilter)
      rejectedFiles.concat(subrejected)
      result.set(fsh.name, subtree)
    } else {
      throw new Error(`Unhandled case: ${fsh}`);
    }
  }
  pruneDeadBranches(result)
  return [
    new Map([...result.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, {numeric: true}))),
    rejectedFiles]
}

export type FileTreeLeaf = {
  file: File
  progress?: "target_exists" | "queue" | {"converting": number, timing?: {passed: number, expected: number}} | "done" | {error: string}
}
export type FileTreeBranch = Map<string, FileTreeLeaf | FileTreeBranch>

type FileTreeProps = {
  files: FileTreeBranch
  removeFile: (name: string[]) => void
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

export function updateLeaf(files: FileTreeBranch, path: string[], update: FileTreeLeaf | null | ((current: FileTreeLeaf) => (FileTreeLeaf | null))): FileTreeBranch {
  const newFiles = new Map([...files])
  const [p, ...restpath] = path
  const item = files.get(p)
  let newItem: FileTreeLeaf | FileTreeBranch | null
  if (restpath.length === 0) {
    if (!(item && "file" in item)) {
      throw new Error(`Error in path: $(path}`)
    }
    if (update === null || "file" in update) {
      newItem = update;
    } else {
      newItem = update(item)
    }
  } else {
    if (!(item instanceof Map)) {
      throw new Error(`Error in path: $(path}`)
    }
    newItem = updateLeaf(item, restpath, update)
    if (newItem.size === 0) {
      newItem = null
    }
  }
  if (newItem === null) {
    newFiles.delete(p)
  } else {
    newFiles.set(p, newItem)
  }
  return newFiles
}

export function findLeaf(files: FileTreeBranch, path: string[]): FileTreeLeaf {
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

export function getAllLeafPaths(files: FileTreeBranch): string[][] {
  return [...files.entries()]
    .flatMap(([name, entry]) =>
    (entry instanceof Map)
      ? getAllLeafPaths(entry).map(path => [name, ...path])
        : [[name]])
}

export async function nonEmptyFileExists(
  directory: FileSystemDirectoryHandle,
  path: string[]
): Promise<boolean> {
  let pointer = directory
  for (const p of path.slice(0, -1)) {
    try {
      pointer = await pointer.getDirectoryHandle(p)
    } catch (e) {
      if ((e as DOMException).name === "NotFoundError") {
        return false
      }
      throw e
    }
  }
  const filename = path.slice(-1)[0]
  let file: FileSystemFileHandle
  try {
    file = await pointer.getFileHandle(filename)
  } catch (e) {
    if ((e as DOMException).name === "NotFoundError") {
      return false
    }
    throw e
  }
  return (await file.getFile()).size > 0
}

async function convertOne(
  files: FileTreeBranch,
  path: string[],
  destination: FileSystemDirectoryHandle,
  conversionAction: ConvertAction,
  setFiles: (cb: (files: FileTreeBranch) => FileTreeBranch) => void
) {
  const leaf = findLeaf(files, path)

  let pointer = destination
  for (const p of path.slice(0, -1)) {
    //probably should catch if there is a file with this directoy name //TODO
    pointer = await pointer.getDirectoryHandle(p, {create: true})
  }
  const start = Date.now()
  try {
    await conversionAction({file: leaf.file}, {dir: pointer}, (progress: FileTreeLeaf["progress"]) => {
      const timeLapsed = (Date.now() - start) / 1000
      const newProgress: FileTreeLeaf["progress"] = (typeof progress === "object" &&"converting" in progress) ? {
        timing: {passed: timeLapsed, expected: timeLapsed / (progress.converting || 0.0001)},
        ...progress,
      } : progress
      setFiles(files =>
        updateLeaf(files, path, leaf => ({file: leaf.file, progress: newProgress})))
    })
  } catch (e) {
    setFiles(files =>
      updateLeaf(files, path, leaf => (
        {file: leaf.file, progress: {error: `error while converting: ${e}`}})))
    console.error(e)
  }
}

export async function convertAll(
  files: FileTreeBranch,
  concurrency: number,
  conversionAction: ConvertAction,
  setFiles: (cb: FileTreeBranch | ((files: FileTreeBranch) => FileTreeBranch)) => void,
) {
  const destination = await window.showDirectoryPicker(
    {id: "mp4save", mode: "readwrite"})
  
  const paths = getAllLeafPaths(files)
  let newFiles = files
  const queuedPaths: string[][] = []
  for (const path of paths) {
    newFiles = updateLeaf(
      newFiles, path, leaf => ({file: leaf.file, progress: "queue"}))
    queuedPaths.push(path)
  }
  setFiles(newFiles)

  const promises: Set<Promise<unknown>> = new Set()
  let finished: Promise<unknown>[] = []
  for (const path of queuedPaths) {
    while (promises.size >= concurrency) {
      await Promise.any(promises).catch(() => {})
      finished.forEach(p => promises.delete(p))
      finished = []
    }
    const promise = convertOne(
      files,
      path,
      destination,
      conversionAction,
      setFiles
    )
    promises.add(promise)
    void(promise.finally(() => finished.push(promise)))
  }
  await Promise.all(promises)
}

function attributesForLeaf(fileTreeLeaf: FileTreeLeaf): {className: string, style: CSSProperties, title?: string} {
  const classes = [css.filename]
  const style: CSSProperties = {}
  let title: undefined | string = undefined
  if (fileTreeLeaf.progress === undefined) {
    classes.push(css.editable)
  } else if (fileTreeLeaf.progress === "queue") {
    classes.push(css.inqueue)
  } else if (fileTreeLeaf.progress === "done") {
    classes.push(css.done)
  } else if (fileTreeLeaf.progress === "target_exists") {
    classes.push(css.target_exists)
  } else if ("converting" in fileTreeLeaf.progress) {
    classes.push(css.converting)
    style["--convert-progress"] = fileTreeLeaf.progress.converting
    style["--convert-progress-text"] = JSON.stringify(`${(fileTreeLeaf.progress.converting * 100).toFixed(1)}%`)
    if (fileTreeLeaf.progress.timing !== undefined) {
      style["--convert-time-text"] = JSON.stringify(
        [formatTime(fileTreeLeaf.progress.timing.passed),
          formatTime(fileTreeLeaf.progress.timing.expected),
        ].join("/"))
    }
    title = `${(fileTreeLeaf.progress.converting * 100).toFixed(1)}% done`
  } else if ("error" in fileTreeLeaf.progress) {
    classes.push(css.error)
    style["--error-message"] = JSON.stringify(fileTreeLeaf.progress.error)
    title = `Error: ${fileTreeLeaf.progress.error}`
  } else {
    const exhaustive: never = fileTreeLeaf.progress
    throw new Error(`Exhaustive check: ${exhaustive}`)
  }
  return {className: classes.join(" "), style, title}
}


export function FileTree({files, removeFile}: FileTreeProps): JSX.Element {
  return <ul className={css.filetree}>
    {[...files.entries()].map(([name, entry]) =>
      <li>
        {(entry instanceof Map)
        ? <>
          <div className={css.directoryname}>{name}</div>
          <FileTree files={entry} removeFile={s => removeFile([name, ...s])} />
        </>
        : <>
          <div {...attributesForLeaf(entry)}>
            {name}
            <span className={css.delete} onClick={() => removeFile([name])}></span>
          </div>
        </>
      }
      </li>
    )}
  </ul>
}
