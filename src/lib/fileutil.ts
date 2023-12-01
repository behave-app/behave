export async function getEntry(
  fsh: FileSystemDirectoryHandle,
  path: string[],
): Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null> {
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
  return await getEntry(entry, restpath)
}

export async function cp_r(
  source: FileSystemDirectoryHandle,
  destination: FileSystemDirectoryHandle
) {
  const BLOCKSIZE = 1024*1024
  for await (const [name, entry] of source.entries()) {
    if (entry instanceof FileSystemDirectoryHandle) {
      const destinationEntry = await destination.getDirectoryHandle(
        name, {create: true})
      await cp_r(entry, destinationEntry)
    } else {
      const destinationEntry = await destination.getFileHandle(
        name, {create: true})
      const sourceFile = await entry.getFile()
      const destinationStream = await destinationEntry.createWritable()
      for (let start = 0; start < sourceFile.size; start += BLOCKSIZE) {
        const end = Math.min(start + BLOCKSIZE,sourceFile.size)
        await destinationStream.write(sourceFile.slice(start, end))
      }
      destinationStream.close()
    }
  }
}
