import * as css from "./filetree.module.css"
import { JSX } from "preact"

export type FileTreeLeaf = {
  file: File
  progress?: "queue" | {"converting": number} | "done" | {error: string}
}
export type FileTreeBranch = Map<string, FileTreeLeaf | FileTreeBranch>

type FileTreeProps = {
  files: FileTreeBranch
  removeFile: (name: string[]) => void
}

function attributesForLeaf(fileTreeLeaf: FileTreeLeaf): {className: string, style: any, title?: string} {
  const classes = [css.filename]
  const style: any = {}
  let title: undefined | string = undefined
  if (fileTreeLeaf.progress === undefined) {
    classes.push(css.editable)
  } else if (fileTreeLeaf.progress === "queue") {
    classes.push(css.inqueue)
  } else if (fileTreeLeaf.progress === "done") {
    classes.push(css.done)
  } else if ("converting" in fileTreeLeaf.progress) {
    classes.push(css.converting)
    style["--convert-progress"] = fileTreeLeaf.progress.converting
    style["--convert-progress-text"] = JSON.stringify(`${(fileTreeLeaf.progress.converting * 100).toFixed(1)}%`)
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
