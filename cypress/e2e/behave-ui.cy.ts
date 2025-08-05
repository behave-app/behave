type FakeFileSystemFileHandle = FileSystemFileHandle & {
  data: ArrayBuffer
  simulateErrors: Map<"createWritable" | "write", boolean>
  getDataString: () => string
  createWritable: () => Promise<FileSystemWritableFileStream>
}

const writableFakeFileHandle = (initalData?: string) => {
  return {
    data: new ArrayBuffer(0, {maxByteLength: 1 << 20}),
    simulateErrors: new Map([
      ["createWritable", false],
      ["write", false],
    ]),
    getDataString: function () {return new TextDecoder().decode(this.data)},
    createWritable: async function(): Promise<FileSystemWritableFileStream> {
      if (this.simulateErrors.get("createWritable")) {
        console.log(this)
        throw new Error("Simulating createWritable fail")
      }
      const bytes = new TextEncoder().encode(initalData ?? "")
      this.data.resize(bytes.byteLength)
      new Uint8Array(this.data).set(bytes)
      return {
        write: async(data: string): Promise<void> => {
          if (this.simulateErrors.get("write")) {
            throw new Error("Simulating write fail")
          }
          const bytes = new TextEncoder().encode(data)
          const oldLength = this.data.byteLength 
          this.data.resize(oldLength + bytes.byteLength)
          const view = new Uint8Array(this.data, oldLength)
          view.set(bytes)
        },
        close: async(): Promise<void> => {}
      } as FileSystemWritableFileStream
    }
  } as FakeFileSystemFileHandle
}

const cancelPicker = (win: Window & typeof globalThis) => {
  throw new win.DOMException("Simulating abort", "AbortError")
}

describe('Behave UI test', function () {
  beforeEach(function () {
    cy.intercept("https://getinsights.io/app/tics", {"ok":true}).as("postTic")
  })

  it('Can start Behave UI', function () {
    cy.visit('/app/index.html')
    .get('a[href="viewer.html"]')
    .click()
    cy.document()
    .contains("h2", "Welcome to Behave")
  })

  it('Changes visuals on file drag', function () {
    cy.visit("/app/viewer.html")
    cy.get("body")
      .contains("h2", "Welcome to Behave")
      .should("not.contain", "Drop your files here")
      .trigger("dragenter")
    cy.get("body")
      .should("contain", "Drop your files here")
      .get(".uploader_uploader")
      .trigger("dragenter")
      .should("contain", "Drop your files here")
      .trigger("dragleave")
      .should("contain", "Drop your files here")
    cy.get("body")
      .trigger("dragleave")
    cy.get("body")
      .should("not.contain", "Drop your files here")
  })

  it("Can deal with file errors/questions", function () {
    cy.visitWithStubbedFileSystem("/app/viewer.html")
    cy.setShowOpenFilePickerResult([
      {pickerPath: "example.82f16f09b8327ed1.behave.det.json", localPath: "cypress/assets/example.82f16f09b8327ed1.behave.det.json"},
    ])
    cy.contains("button", "Start behaviour coding").should("be.disabled")
    cy.contains("button", "Open video file").should("not.be.disabled")
      .click()
    cy.contains("h2", "Error")
    cy.contains("You cannot open a file of type json")
    cy.contains("button", "close").click()

    cy.setShowOpenFilePickerResult([
      {pickerPath: "test/example.82f16f09b8327ed1.behave.mp4", localPath: "cypress/assets/example.82f16f09b8327ed1.behave.mp4"},
    ])
    cy.contains("button", "Open video file").should("not.be.disabled")
      .click()
    cy.contains("example.82f16f09b8327ed1.behave.mp4", {timeout: 20 * 1000})
    cy.contains("hash: 82f16f09b8327ed1")
    cy.setShowOpenFilePickerResult([
      {pickerPath: "example.ffffffffffffffff.behave.det.json", localPath: "cypress/assets/example.82f16f09b8327ed1.behave.det.json", replacer: {from: "82f16f09b8327ed1", to: "ffffffffffffffff"}}])
    cy.contains("button", "Open detection file").should("not.be.disabled")
      .click()
    cy.contains("h2", "Please check the following information")
    cy.contains("button", "cancel").click()
    cy.contains("h3", "Detection file").next().contains("<no detection file>")
    cy.contains("button", "Open detection file").should("not.be.disabled")
      .click()
    cy.contains("h2", "Please check the following information")
    cy.contains("button", "proceed").click()
    cy.contains("h3", "Detection file").next().contains("example.ffffffffffffffff.behave.det.json")
  })

  it("Can import/export ethogram", function () {
    cy.visitWithStubbedFileSystem("/app/viewer.html")
    cy.contains("h2", "Welcome to Behave")
    cy.get("dialog").click(0, 0)
    cy.get(".viewer_sidebar").within(() => {
      cy.get(`button[title~="shortcuts"]`).click()
    })
    cy.window().then(win => {
      cy.setShowSaveFilePickerResult(() => cancelPicker(win))
    })
    cy.window().then(win => {
      cy.spy(win.console, "warn")
        .withArgs("No file selected to save to")
        .as("filePickerCancelled")
    })
    cy.get("@filePickerCancelled").should("not.be.called")
    cy.contains("Using Subject List and Shortcuts").within(() => {
      cy.log("helloi")
      cy.contains("option", "example subjects").should("be.selected")
      cy.get(`button[title~="Export"]`).click()
    })
    cy.get("@filePickerCancelled").should("be.called")
    const datafile = writableFakeFileHandle()
    cy.setShowSaveFilePickerResult(async () => datafile)
    cy.contains("Using Subject List and Shortcuts").within(() => {
      cy.contains("option", "example subjects").should("be.selected")
      cy.get(`button[title~="Export"]`).click()
    })
    cy.window().then(() => {
      const text = datafile.getDataString()
      cy.setShowOpenFilePickerResult([{
        content: text, pickerPath: "example subjects.subject-preset-export.json"}])
    })
    cy.contains("Using Subject List and Shortcuts").within(() => {
      cy.contains("option", "example subjects").should("be.selected")
      cy.get("select").select("Import from file...")
      cy.contains("option", "example subjects (2)").should("be.selected")
    })

  })

  it("Can update ethogram", function () {
    cy.visit("/app/viewer.html")
    cy.contains("h2", "Welcome to Behave")
    cy.get("dialog").click(0, 0)
    cy.get(".viewer_sidebar").within(() => {
      cy.get(`button[title~="shortcuts"]`).click()
    })
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "default").should("be.selected")
      cy.get(`button[title~="Duplicate"]`).click()
      cy.contains("option", "Copy of default").should("be.selected")
      cy.get("select").select("default")
      cy.contains("option", "default").should("be.selected")
      cy.get(`button[title~="Duplicate"]`).click()
      cy.contains("option", "Copy (2) of default").should("be.selected")
      cy.get(`button[title~="Edit"]`).click()
    })
    cy.get("input").type("{backspace} BLA")
    cy.contains("button", "cancel").click()
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "Copy (2) of default").should("be.selected")
      cy.get(`button[title~="Edit"]`).click()
    })
    cy.get("input").type("{backspace} BLA {enter}")
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "Copy (2) of defaul BLA").should("be.selected")
      cy.get("select").select("default")
      cy.contains("option", "default").should("be.selected")
      cy.get(`button[title~="Duplicate"]`).click()
      cy.contains("option", "Copy (2) of default").should("be.selected")
      cy.get(`button[title~="Edit"]`).click()
    })
    cy.get("input").type("{backspace} BLA {enter}")
    cy.contains("There is already a list with this name")
    cy.contains("button", "cancel").click()
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "Copy (2) of default").should("be.selected")
      cy.get(`button[title~="Delete"]`).click()
    })
    cy.contains("button", "no").click()
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "Copy (2) of default").should("be.selected")
      cy.get(`button[title~="Delete"]`).click()
    })
    cy.contains("button", "yes").click()
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "Copy (2) of defaul BLA").should("be.selected")
      cy.get("select").select("default")
      cy.get(`button[title~="Delete"]`).click()
    })
    cy.contains("button", "yes").click()
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "Copy of default").should("be.selected")
      cy.get(`button[title~="Delete"]`).click()
    })
    cy.contains("button", "yes").click()
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "Copy (2) of defaul BLA").should("be.selected")
      cy.get(`button[title~="Delete"]`).click()
    })
    cy.contains("Delete not possible")
    cy.contains("button", "ok").click()
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "Copy (2) of defaul BLA").should("be.selected")
      cy.get("select").select("Create new...")
    })
    cy.get("input").type("my new item")
    cy.contains("button", "cancel").click();
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "Copy (2) of defaul BLA").should("be.selected")
      cy.get("select").select("Create new...")
    })
    cy.get("input").type("my new item")
    cy.contains("button", "ok").click();
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "my new item").should("be.selected")
      cy.get("select").select("Copy (2) of defaul BLA")
      cy.get(`button[title~="Delete"]`).click()
    })
    cy.contains("button", "yes").click()
    cy.contains("Using General Shortcuts").within(() => {
      cy.contains("option", "my new item").should("be.selected")
    })

    cy.contains("button", "Restart video").next().click()
    cy.log("General shortcuts should not have a rename button")
    cy.contains("h2", "Restart video")
      .contains("button", "edit").should("not.exist")
    cy.contains("button", "Delete").should("not.exist")
    cy.contains("button", "Add your first keystroke").click()
    cy.get("body").type("{shift}", {release: false})
    cy.contains(".keyshortcuts_editing_key kbd", "Shift")
    cy.get("body").type("L", {release: true})
    cy.contains("kbd", "Shift").next().contains("kbd", "L")
    cy.get(".keyshortcuts_add_button_small").click()
    cy.get("div.keyshortcuts_shortcut_key")
      .pseudoElementContaining("after", "<recording keystroke> (press key now)")
    cy.get("body").type("{shift}A")
    cy.contains("is also bound to Subject arrow_right Andrea")
    cy.get(".keyshortcuts_shortcut_is_duplicate")
      .contains("kbd", "Shift").next().contains("kbd", "A")
    cy.contains("button", "Close").click()
    cy.contains("button", "Restart video")
      .should("have.class", "keyshortcuts_has_duplicate")

    cy.contains("button", "Andrea")
      .should("have.class", "keyshortcuts_has_duplicate")
      .next()
      .click()
    cy.contains("h2", "Andrea")
      .contains("button", "edit").click()
    cy.get("input").type("aaaaa")
    cy.contains("button", "ok").click()
    cy.contains("h2", "Andreaaaaa")
    cy.contains("button", "Delete")
    cy.get("body").type("{shift}", {release: false})
    cy.contains("is also bound to General arrow_right Restart video")
    cy.get(".keyshortcuts_shortcut_is_duplicate")
      .contains("kbd", "Shift").next().contains("kbd", "A")
      .parent().parent().contains("button", "delete").click()
    cy.contains("is also bound to General arrow_right Restart video")
      .should("not.exist")
    cy.contains("button", "Close").click()
    cy.contains("button", "Andreaaaaa")
      .should("not.have.class", "keyshortcuts_has_duplicate")
      .next().click()
    cy.contains("button", "Delete").click()
    cy.contains("button", "no").click()
    cy.contains("button", "Delete").click()
    cy.contains("button", "yes").click()
    cy.contains("button", "Andreaaaaa")
      .should("not.exist")
  })

  it("Can start a behave", function () {
    cy.visitWithStubbedFileSystem("/app/viewer.html")
    cy.setShowOpenFilePickerResult([
      {pickerPath: "test/example.82f16f09b8327ed1.behave.mp4", localPath: "cypress/assets/other.txt"},
    ])
    cy.contains("button", "Open video file").should("not.be.disabled")
      .click()
    cy.contains("There was a problem opening the video file.")
    cy.contains("button", "close").click()
    cy.setShowOpenFilePickerResult([
      {pickerPath: "test/example.82f16f09b8327ed1.behave.mp4", localPath: "cypress/assets/example.82f16f09b8327ed1.behave.mp4"},
    ])
    cy.contains("button", "Open video file").should("not.be.disabled")
      .click()
    cy.contains("example.82f16f09b8327ed1.behave.mp4", {timeout: 20 * 1000})
    cy.contains("hash: 82f16f09b8327ed1")
    cy.contains("button", "Start behaviour coding").should("not.be.disabled")
      .click()
    cy.get("#myVideoPlayer").should($videos => {
      const video = $videos.get(0) as HTMLVideoElement;
      expect(video.readyState).to.be.at.least(video.HAVE_CURRENT_DATA);
    });
    cy.contains("span", "upload_file").click()

    cy.setShowOpenFilePickerResult([
      {pickerPath: "example.82f16f09b8327ed1.behave.det.json", localPath: "cypress/assets/example.82f16f09b8327ed1.behave.det.json"},
    ])
    cy.contains("button", "Open detection file").should("not.be.disabled")
      .click()
    cy.contains("example.82f16f09b8327ed1.behave.det.json")
    cy.contains("button", "Start behaviour coding").should("not.be.disabled")
      .click()

    cy.get("body")
      .contains("Framenumber: 0")
    cy.get("body")
      .contains("Subjects")

    cy.log("Trying cancelling choosing a directory for the behave file")
    cy.window().then((win) => {
      cy.setShowSaveFilePickerResult(() => cancelPicker(win))
    })
    cy.window().then(win => {
      cy.spy(win.console, "warn")
        .withArgs("Save file selection cancelled, not creating behaviour file")
        .as("filePickerCancelled")
    })
    cy.get("@filePickerCancelled").should("not.be.called")
    cy.get("body")
      .contains("button", "Create new behaviour file")
      .click()
    cy.get("@filePickerCancelled").should("be.called")
    const datafile = writableFakeFileHandle()
    cy.setShowSaveFilePickerResult(async () => datafile)
    cy.get("body")
      .contains("button", "Create new behaviour file")
      .click()
    cy.get(".behaviour_table tbody tr")
      .should("have.length", 1)
    cy.get("body").type("{shift}A")
    cy.get(".behaviour_table tbody tr")
      .should("have.length", 2)
    cy.listMatch(".behaviour_table tbody tr.behaviour_aboutToBeInserted td",
    [/^0$/, /^03-07-2021$/, /^00:55:03$/, /^Andrea/, /^$/, /^$/])

    cy.get("body").type("{shift}C")
    cy.get(".behaviour_table tbody tr.behaviour_aboutToBeInserted")
    .should("not.exist")
    cy.listMatch(".behaviour_table tbody tr.behaviour_selectedLine td",
    [/^0$/, /^03-07-2021$/, /^00:55:03$/, /^Andrea/, /^Climbing$/, /^$/])

    cy.get("body").type("dddddddddd{shift}BD")
    cy.listMatch(".behaviour_table tbody tr.behaviour_selectedLine td",
    [/^10$/, /^03-07-2021$/, /^00:55:13$/, /^Beatrice$/, /^Diving$/, /^$/])

    cy.log("Delete first line and reinsert it")
    cy.get("body")
    .should(() => {
        // wrap in should() so that it's retried
        expect(datafile.getDataString().split("\n")).to.have.length(4)
    })

    cy.get(".viewer_controlpanel")
      .contains("Framenumber: 10")

    cy.get('button[title="previous behaviour line"]').click()
    cy.listMatch(".behaviour_table tbody tr.behaviour_selectedLine td",
    [/^0$/, /^03-07-2021$/, /^00:55:03$/, /^Andrea/, /^Climbing$/, /^$/])
    cy.get(".viewer_controlpanel")
      .contains("Framenumber: 0")

    cy.get('button[title="remove the selected behaviour line"]').click()
    cy.get(".behaviour_table tbody tr.behaviour_selectedLine")
      .should("not.exist")
    cy.get(".behaviour_table tbody tr")
      .should("have.length", 2)
    cy.listMatch(".behaviour_table tbody tr:nth-child(2) td",
    [/^10$/, /^03-07-2021$/, /^00:55:13$/, /^Beatrice$/, /^Diving$/, /^$/])
    cy.get(".viewer_controlpanel")
      .contains("Framenumber: 0")
    
    cy.get("body").type("{shift}BC")
    cy.listMatch(".behaviour_table tbody tr:nth-child(2) td",
    [/^0$/, /^03-07-2021$/, /^00:55:03$/, /^Beatrice/, /^Climbing$/, /^$/])
    cy.listMatch(".behaviour_table tbody tr:nth-child(3) td",
    [/^10$/, /^03-07-2021$/, /^00:55:13$/, /^Beatrice$/, /^Diving$/, /^$/])

    cy.get("body").type("{shift}AC")
    cy.get("body").type("{shift}AD")
    cy.listMatch(".behaviour_table tbody tr:nth-child(2) td",
    [/^0$/, /^03-07-2021$/, /^00:55:03$/, /^Beatrice/, /^Climbing$/, /^$/])
    cy.listMatch(".behaviour_table tbody tr:nth-child(3) td",
    [/^0$/, /^03-07-2021$/, /^00:55:03$/, /^Andrea$/, /^Climbing$/, /^$/])
    cy.listMatch(".behaviour_table tbody tr:nth-child(4) td",
    [/^0$/, /^03-07-2021$/, /^00:55:03$/, /^Andrea$/, /^Diving$/, /^$/])
    cy.listMatch(".behaviour_table tbody tr:nth-child(5) td",
    [/^10$/, /^03-07-2021$/, /^00:55:13$/, /^Beatrice$/, /^Diving$/, /^$/])

    const assertIsSelectedLine = (linenr: number | null) => {
      if (linenr === null) {
      cy.get(".behaviour_table tbody tr.behaviour_selectedLine")
        .should("not.exist")
      } else {
        cy.get(".behaviour_table tbody tr").eq(linenr)
          .should("have.class", "behaviour_selectedLine")
      }
    }
    assertIsSelectedLine(3)
    cy.get(".behaviour_table tbody tr").eq(2).contains("span", /.*/).eq(0).click()
    assertIsSelectedLine(2)
    cy.get('button[title="remove the selected behaviour line"]').click()
    assertIsSelectedLine(2)
    cy.get('button[title="remove the selected behaviour line"]').click()
    assertIsSelectedLine(1)
    cy.get('button[title="remove the selected behaviour line"]').click()
    assertIsSelectedLine(null)
    cy.get('button[title="previous behaviour line"]')
      .should("be.disabled")
    assertIsSelectedLine(null)
    cy.get('button[title="next behaviour line"]').click()
    assertIsSelectedLine(1)
    cy.get('button[title="remove the selected behaviour line"]').click()
    assertIsSelectedLine(null)
    cy.get('button[title="next behaviour line"]')
      .should("be.disabled")
    cy.get("body")
    .should(() => {
        // wrap in should() so that it's retried
        expect(datafile.getDataString().split("\n")).to.have.length(2)
    })
  })

  it("Deals gracefully with failing behaviour file writes", function () {
    cy.visitWithStubbedFileSystem("/app/viewer.html")
    cy.setShowOpenFilePickerResult([
      {pickerPath: "test/example.82f16f09b8327ed1.behave.mp4", localPath: "cypress/assets/example.82f16f09b8327ed1.behave.mp4"},
    ])
    cy.contains("button", "Open video file").should("not.be.disabled")
      .click()
    cy.contains("example.82f16f09b8327ed1.behave.mp4", {timeout: 20 * 1000})
    cy.contains("hash: 82f16f09b8327ed1")
    cy.contains("button", "Start behaviour coding").should("not.be.disabled")
      .click()
    cy.get("#myVideoPlayer").then(videos => {
      const video = (videos.get(0) as HTMLVideoElement)
      cy.wrap(video.readyState).should("be.gte", video.HAVE_CURRENT_DATA)
    })

    const datafile = writableFakeFileHandle()
    cy.then(() => {
      datafile.simulateErrors.set("write", true)
    })

    cy.setShowSaveFilePickerResult(async () => datafile)
    cy.get("body")
      .contains("button", "Create new behaviour file")
      .click()
    cy.get("body")
    .should(() => {
        expect(datafile.getDataString()).to.equal("")
    })
    cy.contains("h2", "Behaviour file write error")
    cy.contains("button", "Close").click()
    cy.get("body")
    .should(() => {
        expect(datafile.getDataString()).to.equal("")
    })
    cy.contains("h2", "Behaviour file write error").should("not.exist")
    cy.get("body").type("{shift}AC")
    cy.contains("h2", "Behaviour file write error")
    cy.contains("button", "Try again").click()
    cy.contains("h2", "Behaviour file write error")
    cy.then(() => {
      datafile.simulateErrors.set("write", false)
    })
    cy.contains("button", "Try again").click()
    cy.get("body")
    .should(() => {
        expect(datafile.getDataString().split("\n")).to.have.length(3)
    })

    cy.then(() => {
      datafile.simulateErrors.set("createWritable", true)
    })
    cy.get("body").type("{shift}AC")
    cy.contains("h2", "Behaviour file write error")
    cy.contains("button", "Try again").click()
    cy.contains("h2", "Behaviour file write error")
    cy.then(() => {
      datafile.simulateErrors.set("createWritable", false)
    })
    cy.contains("button", "Try again").click()
    cy.get("body")
    .should(() => {
        expect(datafile.getDataString().split("\n")).to.have.length(4)
    })
  })
})
