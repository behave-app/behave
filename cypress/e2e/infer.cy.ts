const ALLOWED_DIFFERENCE = 0.05

describe('Inference test', () => {
  it('Has an infer link', () => {
    cy.visit('/app/index.html')
    .get('a[href="infer.html"]')
    .click()
    cy.document()
    .contains("h1", "Infer videos (detect items)")
  })
  it('Changes visuals on file drag', () => {
    cy.visit("/app/infer.html")
    cy.get("body")
    .should("not.contain", "Drop files here")
    .trigger("dragenter")
    .should("contain", "Drop files here")
    .get(".upload_fullScreenDropInfo2")  // for some reason this gets a "2" for infer. Hope that is always
    .trigger("dragenter")
    .should("contain", "Drop files here")
    .trigger("dragleave")
    .should("contain", "Drop files here")
    cy.document()
    .get("body")
    .trigger("dragleave")
    .should("not.contain", "Drop files here")
  })

  it("Infers from MTS file", () => {
    cy.window().then(win => cy.wrap(null).then(async () => {
      const opfs = await win.navigator.storage.getDirectory()
      for await (const [name, _entry] of opfs.entries()) {
        await opfs.removeEntry(name, {recursive: true})
      }
      win.localStorage.clear()
    }))
    cy.setShowDirectoryPickerResult(
      ["model.json", "metadata.yaml", ...[1, 2, 3].map(i => `group1-shard${i}of3.bin`)].map(filename =>
      ({localPath: `cypress/assets/yolov8-little-auk.model/${filename}`, pickerPath: filename}))
    )
    const assertDefaultValues = () => {
    cy.contains("Model loaded").should("not.exist")
    cy.contains("button", "Change model").should("not.exist")
    cy.contains("button", "Unload model").should("not.exist")
    cy.contains("dt", "Backend").next().find("select").should("have.value", "webgl")
    cy.contains("dt", "Yolo version").next().find("select").should("have.value", "v8")

    }
    cy.visitWithStubbedFileSystem("/app/infer.html")
    .contains("At the moment no yolo model is selected. Please add a model in order to start")
    .get("button")
    .contains("add a model")
    .click()
    assertDefaultValues()
    cy.contains("dt", "Backend").next().find("select").select("webgpu")
    cy.contains("dt", "Yolo version").next().find("select").select("v5")
    cy.contains("button", "Select model").click()
    cy.contains("Model loaded")
    cy.contains("button", "Cancel").click()

    cy.contains("At the moment no yolo model is selected. Please add a model in order to start")
    .get("button")
    .contains("add a model")
    .click()
    assertDefaultValues()
    cy.contains("button", "Select model").click()
    cy.contains("Model loaded")
    cy.contains("button", "Change model")
    cy.contains("button", "Save").click()
    cy.contains("Loaded model: showDirectoryPickerResult (v8 / webgl)")

    cy.contains("button", "change").click()
    cy.contains("button", "Change model")
    cy.contains("button", "Unload model")
    cy.contains("dt", "Backend").next().find("select").select("webgpu")
    cy.contains("button", "Save").click()
    cy.contains("Loaded model: showDirectoryPickerResult (v8 / webgpu)")

    cy.setShowOpenFilePickerResult([])
    cy.setShowOpenFilePickerResult([
      {pickerPath: "test/file.MTS", localPath: "cypress/assets/example.MTS"},
      "cypress/assets/other.txt",
    ])
    cy.contains("button", "Start inference").should("be.disabled")
    cy.contains("Add files").click()
    cy.contains(".filetree_filename2", /^file\.MTS$/)
    cy.contains(".filetree_filename2", /^other\.txt/).should("not.exist")
    // TODO: test cancel showOpenFilePicker()
    cy.contains("button", "Start inference").should("be.not.disabled").click()
    cy.contains(".filetree_filename2.filetree_converting2", /^file\.MTS$/)
    cy.contains(".filetree_filename2.filetree_done2", /^file\.MTS$/, {timeout: 20 * 60 * 1000})
    cy.assertFileExistsInPickedDirectory("file.82f16f09b8327ed1.behave.det.json")
    let groundTruth: Record<string, unknown> & {
      frameInfo: ReadonlyArray<{
      detections: ReadonlyArray<Record<string, number>>
    }>}
    cy.readFile("cypress/assets/example.82f16f09b8327ed1.behave.det.json", "utf-8").then(res => {
      groundTruth = res as typeof groundTruth
    })
    cy.window().then(win => cy.wrap(null).then(async () => {
      const opfs = await win.navigator.storage.getDirectory()
      const dir = await opfs.getDirectoryHandle("showDirectoryPickerResult")
      const file = await (await dir.getFileHandle("file.82f16f09b8327ed1.behave.det.json")).getFile()
      const data = JSON.parse(await file.text()) as typeof groundTruth
      for (const key of Object.keys(groundTruth)) {
        if (key !== "frameInfo") {
          cy.wrap(JSON.stringify(data[key])).should("equal", JSON.stringify(groundTruth[key]))
          continue
        }
        const nrFrames = groundTruth.frameInfo.length
        cy.wrap(data.frameInfo.length).should("equal", nrFrames)
        for (let framenr = 0; framenr < nrFrames; framenr++) {
          const groundDetections = groundTruth.frameInfo[framenr].detections
          const foundDetections = data.frameInfo[framenr].detections
          const compareMap = groundDetections.map(gd => foundDetections.map(fd =>
            Object.keys(gd).every(k => Math.abs(gd[k] - fd[k]) < ALLOWED_DIFFERENCE)
          ))
          cy.wrap(groundDetections.length).should("equal", foundDetections.length)
          cy.wrap(compareMap.every(it => it.some(n => n))).should("be.true")
        }
      }
    }))
    cy.wait("@postTic").its("request.body").then($body => {
      cy.wrap($body).its("id").should("equal", "page-views")
      cy.wrap($body).its("projectId").should("equal", "agV6GnAAVoIvJDuW")
      cy.wrap($body).its("parameters.path").should("equal", "/app/infer.html")
    })
    cy.wait("@postTic").its("request.body").then($body => {
      cy.wrap($body).its("id").should("equal", "infer-done")
      cy.wrap($body).its("projectId").should("equal", "agV6GnAAVoIvJDuW")
      cy.wrap($body).its("parameters.extension").should("equal", "MTS")
      cy.wrap($body).its("parameters.filesize").should("equal", "XS (<100MB)")
    })
  })
})
