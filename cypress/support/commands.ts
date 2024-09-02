export type Files = null | ReadonlyArray<string | {localPath: string, pickerPath: string}>

const OPEN_PICKER_DIRNAME = "showOpenFilePickerResult"
const SAVE_PICKER_DIRNAME = "showDirectoryPickerResult"
Cypress.Commands.add("visitWithStubbedFileSystem", (url, options) => {
  let toedit: typeof options
  if (options === undefined) {
    if (typeof url === "object") {
      toedit = url
    } else {
      options = {}
      toedit = options
    }
  } else {
    toedit = options
  }
  const oldBeforeLoad = ((toedit.onBeforeLoad !== undefined) || (() => {})) as CallableFunction
  toedit.onBeforeLoad = (win: typeof window) => {
    oldBeforeLoad(win)
    cy.stub(win, "showOpenFilePicker").callsFake(async () => {
      const getFilesRecursively = async(dir: FileSystemDirectoryHandle): Promise<FileSystemFileHandle[]> => {
        let filehandles: FileSystemFileHandle[] = []
        for await (const [_name, entry] of dir.entries()) {
          if (entry instanceof win.FileSystemFileHandle) {
            filehandles.push(entry as FileSystemFileHandle)
          } else {
            filehandles = [...filehandles, ...await getFilesRecursively(entry as FileSystemDirectoryHandle)]
          }
        }
        return filehandles
      }
      const opfsRoot = await win.navigator.storage.getDirectory()
      let maindir: FileSystemDirectoryHandle
      try {
        maindir = await opfsRoot.getDirectoryHandle(OPEN_PICKER_DIRNAME, {create: false})
      } catch (e) {
        if (e instanceof win.DOMException && e.name === 'NotFoundError') {
          throw new win.DOMException("Simulating abort", "AbortError")
        } else {
          assert.fail(`${e}`)
        }
      }
      return getFilesRecursively(maindir)
    })
    cy.stub(win, "showDirectoryPicker").callsFake(async () => {
      const opfsRoot = await win.navigator.storage.getDirectory()
      let maindir: FileSystemDirectoryHandle
      try {
        maindir = await opfsRoot.getDirectoryHandle(SAVE_PICKER_DIRNAME, {create: false})
      } catch (e) {
        if (e instanceof win.DOMException && e.name === 'NotFoundError') {
          throw new win.DOMException("Simulating abort", "AbortError")
        } else {
          assert.fail(`${e}`)
        }
      }
      return maindir
    })
  }
  if (typeof url === "string") {
    cy.visit(url, options)
  } else {
    cy.visit(url)
  }
})

const prepareOPFS = (files: Parameters<typeof cy["setShowDirectoryPickerResult"]>[0], dirname: string) => {
  cy.window().then(win => {
    cy.wrap(null).then(async () => {
      const opfsRoot = await win.navigator.storage.getDirectory()
      try {
        await opfsRoot.removeEntry(dirname, {recursive: true})
      } catch (e) {
        if (e instanceof win.DOMException && e.name === 'NotFoundError') {
          console.debug('Not removing dir since it does not exist')
        } else {
          throw e;
        }
      }
      if (files === null) {
        return
      }
      console.log(`made ${dirname}`)
      const maindir = await opfsRoot.getDirectoryHandle(dirname, {create: true})
      for (const entry of files) {
        const {localPath, pickerPath} = typeof entry === "object" ? entry : {
          localPath: entry, pickerPath: entry}
        cy.readFile(localPath, null).then(buffer => {
          cy.wrap(null).then(async () => {
            let dir = maindir
            let path = pickerPath.split("/")
            while (path.length > 1) {
              dir = await dir.getDirectoryHandle(path[0], {create: true})
              path = path.slice(1)
            }
            const file = await dir.getFileHandle(path[0], {create: true})
            const writableFile = await file.createWritable()
              await writableFile.write(buffer)
            await writableFile.close()
          })
        })
      }
    })
  })
}

Cypress.Commands.add(
  "setShowOpenFilePickerResult", (files) => prepareOPFS(files, OPEN_PICKER_DIRNAME))
Cypress.Commands.add(
  "setShowDirectoryPickerResult", (files) => prepareOPFS(files, SAVE_PICKER_DIRNAME))
Cypress.Commands.add(
  "assertFileExistsInPickedDirectory", (filename) => {
    cy.window().then(win => {
      cy.wrap(null).then(async () => {
        const opfsRoot = await win.navigator.storage.getDirectory()
        let dir: FileSystemDirectoryHandle
        try {
          dir = await opfsRoot.getDirectoryHandle(SAVE_PICKER_DIRNAME, {create: false})
        } catch (e) {
          if (e instanceof win.DOMException && e.name === 'NotFoundError') {
            assert.fail(`Picker directory does not exist`)
          } else {
            assert.fail(`${e}`)
          }
        }
        try {
          await dir.getFileHandle(filename, {create: false})
        } catch (e) {
          if (e instanceof win.DOMException && e.name === 'NotFoundError') {
            assert.fail(`File ${filename} does not exist`)
          } else {
            assert.fail(`${e}`)
          }
        }
      })
    })
  })
