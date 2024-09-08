import { createXXHash64 } from 'hash-wasm';

export async function getEntry(
  fsh: FileSystemDirectoryHandle,
  path: string[],
): Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null> {
  if (path.length === 0) {
    return fsh
  }
  const [name, ...restpath] = path
  let entry: FileSystemDirectoryHandle;
  try {
    entry = await fsh.getDirectoryHandle(name)
  } catch (e) {
    if ((e as DOMException).name == "NotFoundError") {
      return null
    }
    if ((e as DOMException).name == "TypeMismatchError") {
      if (restpath.length === 0) {
        return await fsh.getFileHandle(name)
      } else {
        // entry is file, but we have some path left, so not found
        return null
      }
    }
    throw(e)
  }
  if (restpath.length === 0) {
    return entry
  }
  return await getEntry(entry, restpath)
}

export async function cp(
  sourceFile: File,
  destinationEntry: FileSystemFileHandle,
) {
  const BLOCKSIZE = 1024*1024
  const destinationStream = await destinationEntry.createWritable()
  for (let start = 0; start < sourceFile.size; start += BLOCKSIZE) {
    const end = Math.min(start + BLOCKSIZE,sourceFile.size)
    await destinationStream.write(sourceFile.slice(start, end))
  }
  await destinationStream.close()
}

export async function cp_r(
  source: FileSystemDirectoryHandle,
  destination: FileSystemDirectoryHandle
) {
  for await (const [name, entry] of source.entries()) {
    if (entry instanceof FileSystemDirectoryHandle) {
      const destinationEntry = await destination.getDirectoryHandle(
        name, {create: true})
      await cp_r(entry, destinationEntry)
    } else {
      const destinationEntry = await destination.getFileHandle(
        name, {create: true})
      await cp(await entry.getFile(), destinationEntry)
    }
  }
}

export async function xxh64sum(
  file: File,
): Promise<string> {
  const START_END_READ_PART = 5 * 1024 * 1024 // we only read this many bytes from the start/end
  const hasher = await createXXHash64()
  hasher.init()
  if (file.size < 2 * START_END_READ_PART) {
    hasher.update(new Uint8Array(await file.arrayBuffer()))
  } else {
    hasher.update(new Uint8Array(await file.slice(0, START_END_READ_PART).arrayBuffer()))
    hasher.update(new Uint8Array(await file.slice(file.size -START_END_READ_PART).arrayBuffer()))
  }
  return hasher.digest("hex")
}
