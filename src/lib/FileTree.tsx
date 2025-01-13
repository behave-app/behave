import * as css from "./filetree.module.css"
import { JSX } from "preact"
import { ObjectEntries, ObjectFromEntries, formatTime } from "./util";
import { CSSProperties } from "preact/compat";

export type ConvertAction = (
  input: {file: File},
  output: {dir: FileSystemDirectoryHandle},
  forceOverwrite: boolean,
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
  fileFilter: (file: File) => boolean | string,
): Promise<FileTreeBranch> {
  const result: FileTreeBranch = new Map()
  for (const fsh of fshs) {
    if (fsh instanceof FileSystemFileHandle) {
      const file = await fsh.getFile()
      const filterResult = fileFilter(file)
      result.set(fsh.name, {
        file: await fsh.getFile(),
        ...(filterResult === true ? {}
          : filterResult === false ? {progress: {error: "Filetype not supported, file will be skipped"}}
          : {progress: {warning: filterResult}}),
      })
    } else if (fsh instanceof FileSystemDirectoryHandle) {
      const subtree = await readFileSystemHandle(
        await fromAsync(fsh.values()), fileFilter)
      result.set(fsh.name, subtree)
    } else {
      throw new Error(`Unhandled case: ${fsh}`);
    }
  }
  console.log(result)
  return new Map([...result.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, {numeric: true})))
}

export type FileTreeLeaf = {
  file: File
  progress?:
  "target_exists"
  | "queue"
  | {"converting": number, timing?: {passed: number, expected: number}}
  | "done"
  | {error: string}
  | {warning: string}
  forceOverwrite?: boolean
}
export type FileTreeBranch = Map<string, FileTreeLeaf | FileTreeBranch>

function removeLeaf(files: FileTreeBranch, path: string[]): FileTreeBranch {
  return updateLeaf(files, path, null)
}

function forceOverwriteLeaf(files: FileTreeBranch, path: string[]): FileTreeBranch {
  return updateLeaf(files, path, current => ({...current, progress: "queue", forceOverwrite: true}))
}

function ignoreWarning(files: FileTreeBranch, path: string[]): FileTreeBranch {
  return updateLeaf(files, path, current => ({...current, progress: undefined}))
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

export function getAllLeafsAndPaths(
  files: FileTreeBranch
): Record<string, {path: string[], leaf: FileTreeLeaf}> {
  type Entry = [string, {path: string[], leaf: FileTreeLeaf}]
  return ObjectFromEntries([...files.entries()]
    .flatMap(([name, entry]) =>
    (entry instanceof Map)
      ? ObjectEntries(getAllLeafsAndPaths(entry)).map(
      ([key, val]) => [
      `${name}/${key}`, {...val, path: [name, ...val.path]}] as Entry)
        : [[name, {path: [name], leaf: entry}]] as Entry[]))
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
    await conversionAction(
      {file: leaf.file},
      {dir: pointer},
      leaf.forceOverwrite ?? false,
      (progress: FileTreeLeaf["progress"]) => {
        const timeLapsed = (Date.now() - start) / 1000
        const newProgress: FileTreeLeaf["progress"] = (typeof progress === "object" &&"converting" in progress) ? {
          timing: {passed: timeLapsed, expected: timeLapsed / (progress.converting || 0.0001)},
          ...progress,
        } : progress
        setFiles(files =>
          updateLeaf(
            files, path, leaf => ({file: leaf.file, progress: newProgress})))
      })
  } catch (e) {
    setFiles(files =>
      updateLeaf(files, path, leaf => (
        {file: leaf.file, progress: {error: `error while converting: ${e}`}})))
    console.error(e)
  }
}

export function setStateAndConvertNextIfPossible(
  files: FileTreeBranch,
  concurrency: number,
  destination: FileSystemDirectoryHandle,
  conversionAction: ConvertAction,
  setFiles: (cb: FileTreeBranch | ((files: FileTreeBranch) => FileTreeBranch)) => void,
  setState: (state: "uploading" | "converting" | "done") => void
) {
  let newFiles = files
  let nrRunning = 0
  let firstQueued: string[] | undefined
  const paths = getAllLeafsAndPaths(files)
  for (const [_, {path: path, leaf}] of ObjectEntries(paths)) {
    if (leaf.progress === undefined) {
      newFiles = updateLeaf(newFiles, path, {...leaf, progress: "queue"})
    } else if (typeof leaf.progress === "object" && "converting" in leaf.progress) {
      nrRunning++;
    }
    else if (firstQueued === undefined && leaf.progress === "queue") {
      firstQueued = path
    }
  }
  if (newFiles !== files) {
    setFiles(newFiles)
    return
  }
  if (nrRunning >= concurrency) {
    return
  }
  if (firstQueued) {
    void(convertOne(files, firstQueued, destination, conversionAction, setFiles))
    return
  }
  if (nrRunning === 0) {
    setState("done")
  }
}

function attributesForLeaf(fileTreeLeaf: FileTreeLeaf): {
  className: string,
  style: CSSProperties,
  title: string | undefined,
  ignoreWarningButton: boolean,
  forceOverwriteButton: boolean,
  deleteButton: boolean
} {
  const classes = [css.filename]
  const style: CSSProperties = {}
  let forceOverwriteButton = false
  let deleteButton = false
  let ignoreWarningButton = false
  let title: undefined | string = undefined
  if (fileTreeLeaf.progress === undefined) {
    classes.push(css.ready)
    deleteButton = true
  } else if (fileTreeLeaf.progress === "queue") {
    deleteButton = true
    classes.push(css.inqueue)
  } else if (fileTreeLeaf.progress === "done") {
    classes.push(css.done)
  } else if (fileTreeLeaf.progress === "target_exists") {
    deleteButton = true
    forceOverwriteButton = true
    classes.push(css.warning)
    style["--warning-message"] = JSON.stringify("Target file already exists, not overwriting")
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
    deleteButton = true
    classes.push(css.error)
    style["--error-message"] = JSON.stringify(fileTreeLeaf.progress.error)
    title = `Error: ${fileTreeLeaf.progress.error}`
  } else if ("warning" in fileTreeLeaf.progress) {
    deleteButton = true
    ignoreWarningButton = true
    classes.push(css.warning)
    style["--warning-message"] = JSON.stringify(fileTreeLeaf.progress.warning)
    title = `Warning: ${fileTreeLeaf.progress.warning}`
  } else {
    const exhaustive: never = fileTreeLeaf.progress
    throw new Error(`Exhaustive check: ${exhaustive}`)
  }
  return {className: classes.join(" "), style, title, forceOverwriteButton, deleteButton, ignoreWarningButton}
}

type FileTreeLeafElementProps = {
  setFiles: (cb: (files: FileTreeBranch) => FileTreeBranch) => void
  path: string[]
  leaf: FileTreeLeaf
}


export function FileTreeLeafElement({setFiles, path, leaf}: FileTreeLeafElementProps): JSX.Element {
const {className, style, title, ignoreWarningButton, forceOverwriteButton, deleteButton} = attributesForLeaf(leaf)
  return <div className={css.leaf}>
    <div className={className} style={style} title={title}>
      {path.at(-1)}
    </div>
    <div className={css.buttons}>
      {ignoreWarningButton && <button onClick={() => setFiles(files => ignoreWarning(files, path))}>Ignore warning</button>}
      {forceOverwriteButton && <button onClick={() => setFiles(files => forceOverwriteLeaf(files, path))}>Overwrite</button>}
      {deleteButton && <button onClick={() => setFiles(files => removeLeaf(files, path))}>&#x1f5d1;</button>}
    </div>
  </div>

}

type FileTreeProps = {
  files: FileTreeBranch
  setFiles: (cb: (files: FileTreeBranch) => FileTreeBranch) => void
  parentPath: string[]
}


export function FileTree({files, setFiles, parentPath}: FileTreeProps): JSX.Element {
  return <ul className={css.filetree}>
    {[...files.entries()].map(([name, entry]) => {
      const path = [...parentPath, name]
      return <li>
        {(entry instanceof Map)
        ? <>
          <div className={css.directoryname}>{name}</div>
          <FileTree files={entry}
              parentPath={path}
              setFiles={setFiles}
          />
        </>
        : <FileTreeLeafElement
            setFiles={setFiles}
            path={path}
            leaf={entry} />
      }
      </li>
    })}
  </ul>
}
