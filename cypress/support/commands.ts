import {OPEN_PICKER_DIRNAME, DIRECTORY_PICKER_DIRNAME} from "./constants"
const MB = 1024 * 1024
let showSaveFilePickerMethod: typeof showSaveFilePicker | null = null

export type Files = null | ReadonlyArray<string
| {localPath: string, pickerPath: string, replacer?: {from: RegExp | string, to: string}}
| {content: string, pickerPath: string, replacer?: {from: RegExp | string, to: string}}
>

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
    cy.stub(win, "showSaveFilePicker").callsFake(async (options) => {
      if (showSaveFilePickerMethod === null) {
        throw new win.DOMException("Simulating abort", "AbortError")
      } else {
        return showSaveFilePickerMethod(options)
      }
    })
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
        maindir = await opfsRoot.getDirectoryHandle(DIRECTORY_PICKER_DIRNAME, {create: false})
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
    })
    if (files === null) {
      console.log("no dir")
      return
    }
    cy.then(async () => {
      const opfsRoot = await win.navigator.storage.getDirectory()
      console.log(`made ${dirname}`)
      return await opfsRoot.getDirectoryHandle(dirname, {create: true})
    }).as("maindirWrapper")
    for (const entry of files) {
      const pickerPath = typeof entry === "string" ? entry : entry.pickerPath
      cy.get<FileSystemDirectoryHandle>("@maindirWrapper").then(async (maindir) => {
        let dir = maindir!
        let path = pickerPath.split("/")
        while (path.length > 1) {
          dir = await dir.getDirectoryHandle(path[0], {create: true})
          path = path.slice(1)
        }
        const file = await dir.getFileHandle(path[0], {create: true})
        return await file.createWritable()
      }).as("writableFileWrapper")
      if (typeof entry === "object" && "content" in entry) {
        cy.get<FileSystemWritableFileStream>("@writableFileWrapper").then(writableFile => writableFile.write(new TextEncoder().encode(entry.content)))
      } else {
        const replacer = typeof entry === "string" ? undefined : entry.replacer
        cy.task("splitFileIntoParts", {
          fileName: (typeof entry === "string" ? entry : entry.localPath),
          maxSize: 50 * MB
        }).then((parts) => {
            if (replacer) {
              if (parts.length > 1) {
                throw new Error("Replacer not supported when more than 1 file part")
              }
            }
            for (const part of parts) {
              cy.readFile(part, null, {timeout: 100000}).then(buffer => {
                if (replacer) {
                  buffer = Cypress.Buffer.from(
                    buffer.toString("utf8").replace(replacer.from, replacer.to),
                    "utf8")
                }
                cy.get<FileSystemWritableFileStream>("@writableFileWrapper").then(writableFile => writableFile.write(buffer))
              })
            }
          })
      }
      cy.get<FileSystemWritableFileStream>("@writableFileWrapper").then(writableFile => writableFile.close())
      cy.task("splitCleanUp")
    }
  })
}

// cypress/support/commands.ts

Cypress.Commands.addQuery('pseudoElementContent', (pseudo: 'before' | 'after') => {
  return function $pseudoContent(subject: JQuery<HTMLElement>) {
    const el = subject.get(0)
    // Get the computed style for the element and the specified pseudo-element
    const computedStyle = window.getComputedStyle(el, `::${pseudo}`);
    const content = computedStyle.getPropertyValue('content');

    return JSON.parse(content);
  };
});


Cypress.Commands.add(
  "setShowOpenFilePickerResult", (files) => prepareOPFS(files, OPEN_PICKER_DIRNAME))
Cypress.Commands.add(
  "setShowDirectoryPickerResult", (files) => prepareOPFS(files, DIRECTORY_PICKER_DIRNAME))
Cypress.Commands.add(
  "setShowSaveFilePickerResult", (method: typeof showSaveFilePicker) => {
    showSaveFilePickerMethod = method
  })

Cypress.Commands.add(
  "assertFileExistsInPickedDirectory", (filename) => {
    cy.window().then(win => {
      cy.wrap(null).then(async () => {
        const opfsRoot = await win.navigator.storage.getDirectory()
        let dir: FileSystemDirectoryHandle
        try {
          dir = await opfsRoot.getDirectoryHandle(DIRECTORY_PICKER_DIRNAME, {create: false})
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

Cypress.Commands.add(
  "listMatch", (listSelector, expected) => {
    cy.get(listSelector).should("have.length", expected.length)
    for (let i=0; i<expected.length; i++) {
      cy.get(listSelector)
        .eq(i)
        .contains(expected[i])
    }
  })
