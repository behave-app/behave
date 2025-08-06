import {OPEN_PICKER_DIRNAME, DIRECTORY_PICKER_DIRNAME} from "./constants"
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
      if (files === null) {
        console.log("no dir")
        return
      }
      console.log(`made ${dirname}`)
      const maindir = await opfsRoot.getDirectoryHandle(dirname, {create: true})
      for (const entry of files) {
        const contentChainable = typeof entry === "string"
        ? cy.readFile(entry, null)
        : "localPath" in entry
        ? cy.readFile(entry.localPath, null)
        : cy.wrap(Cypress.Buffer.from(entry.content, "utf8"))
        const pickerPath = typeof entry === "string" ? entry : entry.pickerPath
        const replacer = typeof entry === "string" ? undefined : entry.replacer
        contentChainable.then(buffer => {
          cy.wrap(null).then(async () => {
            let dir = maindir
            let path = pickerPath.split("/")
            while (path.length > 1) {
              dir = await dir.getDirectoryHandle(path[0], {create: true})
              path = path.slice(1)
            }
            if (replacer) {
                console.log(buffer.toString("utf8").replace(replacer.from, replacer.to))
              buffer = Cypress.Buffer.from(
                buffer.toString("utf8").replace(replacer.from, replacer.to),
                "utf8")
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

Cypress.Commands.addQuery('pseudoElementContaining', function $pseudoElementContaining(
  pseudo: 'before' | 'after',
  containing: string | RegExp,
  options = {}
) {
    if (pseudo !== "before" && pseudo !== "after") {

      const err = `pseudoElementContaining() first parameter should be "before" or "after", you put in \`${pseudo}\`.`
      throw new TypeError(err)
    }
    if (typeof containing !== "string"
      && (typeof containing !== "object" || !(containing instanceof RegExp))) {

      const err = `pseudoElementContaining() second parameter should be a string or an regexp, you put in \`${containing}\`.`
      throw new TypeError(err)
    }
    if (
      options === null ||
        typeof options !== 'object' ||
        !(Object.getPrototypeOf(options) === Object.prototype ||
          Object.getPrototypeOf(options) === null)
    ) {
      const err = `pseudoElementContaining() requires an \`options\` object. You passed in: \`{options}\``
      throw new TypeError(err)
    }
    const log = options.log !== false && Cypress.log({ timeout: options.timeout })

    // TS bug in Cypress v14: 'timeout' not typed on EnqueuedCommandAttributes
    // @ts-expect-error See https://github.com/cypress-io/cypress/issues/30198
    this.set('timeout', options.timeout)

    return function pseudoElementContainingInner(subject: JQuery<HTMLElement>) {
      const $el = subject.filter((_, el) => {
        // Get the computed style for the element and the specified pseudo-element
        const computedStyle = window.getComputedStyle(el, `::${pseudo}`);
        const content = computedStyle.getPropertyValue('content');
        if (content === "none") {
          return false
        }
        const contentString = JSON.parse(content);
        if (typeof contentString !== "string") {
          return false
        }
        if (typeof containing === "string") {
          return contentString.indexOf(containing) !== -1
        }
        return containing.test(contentString)
      })

      if (log !== false) {
        log.set({
          $el,
          consoleProps: () => {
            return {
              Yielded: $el?.length ? $el[0] : '--nothing--',
              Elements: $el.length,
            }
          },
        })
      }

    if ($el.length === 0 && !(options?.allowEmpty)) {
      throw new Error(
      `No elements found for ::\`${pseudo}\` containing \`${containing}\``)
    }
    return $el
  }
})

// cypress/support/commands.ts

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
