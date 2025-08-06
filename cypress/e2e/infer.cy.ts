const ALLOWED_DIFFERENCE = 0.05

describe('Inference test', function () {
  beforeEach(function () {
    cy.intercept("https://getinsights.io/app/tics", {"ok":true}).as("postTic")
  })

  it('Has an infer link', function () {
    cy.visit('/app/index.html')
      .get('a[href="infer.html"]')
      .click()
    cy.document()
      .contains("h1", "Infer videos (detect items)")
  })

  it('Changes visuals on file drag', function () {
    cy.visit("/app/infer.html")
    cy.get("body")
      .should("not.contain", "Drop files here")
      .trigger("dragenter")
    cy.get("body")
      .should("contain", "Drop files here")
      .get(".upload_fullScreenDropInfo2")  // for some reason this gets a "2" for infer. Hope that is always
      .trigger("dragenter")
    cy.get("body")
      .should("contain", "Drop files here")
      .get(".upload_fullScreenDropInfo2")  // for some reason this gets a "2" for infer. Hope that is always
      .trigger("dragleave")
    cy.get("body")
      .should("contain", "Drop files here")
    cy.get("body")
      .trigger("dragleave")
    cy.get("body")
      .should("not.contain", "Drop files here")
  })

  it("Infers from MTS file", function () {
    cy.window().then(win => cy.wrap(null).then(async () => {
      const opfs = await win.navigator.storage.getDirectory()
      for await (const [name, _entry] of opfs.entries()) {
        await opfs.removeEntry(name, {recursive: true})
      }
      win.localStorage.clear()
    }))
    cy.setShowOpenFilePickerResult(
      ["cypress/assets/yolov8-little-auk-model.onnx"]
    )
    const assertDefaultValues = () => {
      cy.contains("yolov8-little-auk-model.onnx loaded").should("not.exist")
      cy.contains("No model selected")
    }
    cy.visitWithStubbedFileSystem("/app/infer.html")
      .contains("<no model>")
    cy.contains("button", "Add Model")
      .click()
    assertDefaultValues()
    cy.contains("button", "Select model").click()
    cy.contains("yolov8-little-auk-model.onnx")
    cy.contains("button", "Cancel").click()

    cy.contains("<no model>")
    cy.contains("button", "Add Model")
      .click()
    assertDefaultValues()
    cy.contains("button", "Select model").click()
    cy.contains("yolov8-little-auk-model.onnx")

    cy.contains("Backend").get("select").should("have.value", "webgpu")

    cy.contains("Test report", { timeout: 20 * 60 * 1000 })
    cy.contains("button", "Save")
      .click();
    cy.contains("yolov8-little-auk-model.onnx (webgpu)")

    cy.setShowOpenFilePickerResult([
      // NOTE: Make sure file.MTS is alphabetically first
      {pickerPath: "test/example.MTS", localPath: "cypress/assets/example.MTS"},
      {pickerPath: "test/example2.mp4", localPath: "cypress/assets/example2.mp4"},
      {pickerPath: "test/example-sps-pps-extradata.mp4", localPath: "cypress/assets/example-sps-pps-extradata.mp4"},
      {pickerPath: "test/not-an-mts-file.MTS", localPath: "cypress/assets/other.txt"},
      {pickerPath: "test/file.82f16f09b8327ed1.behave.mp4", localPath: "cypress/assets/example.82f16f09b8327ed1.behave.mp4"},
      {pickerPath: "test/not-an-mts-file.MTS", localPath: "cypress/assets/other.txt"},
      "cypress/assets/other.txt",
    ])
    cy.contains("button", "Start Inference").should("be.disabled")
    cy.contains("button", "Add Files").click()
    cy.contains(".filetree_filename2.filetree_ready2", /^example\.MTS$/)
    cy.contains(".filetree_filename2.filetree_ready2", /^example2\.mp4$/)
    cy.contains(".filetree_filename2.filetree_warning2", /^file.82f16f09b8327ed1.behave.mp4$/)
      .pseudoElementContaining("after", "Use the original")
    cy.contains(".filetree_filename2", /^file.82f16f09b8327ed1.behave.mp4$/)
      .parent().find("button:last-child").click()
    cy.contains(".filetree_filename2", /^file.82f16f09b8327ed1.behave.mp4$/)
      .should("not.exist")
    cy.contains(".filetree_filename2.filetree_error2", /^other\.txt/)
      .pseudoElementContaining("after", "Filetype not supported")
    cy.contains("You have added some files with an unsupported extension.")
    cy.contains("Some infer sessions seem to have failed.").should("not.exist")

    cy.setShowDirectoryPickerResult(null)
    cy.window().then(win => {
      cy.spy(win.console, "warn")
        .withArgs("Directory selection aborted, nothing happened")
        .as("directoryPickerCancelled")
    })
    cy.get("@directoryPickerCancelled").should("not.be.called")
    cy.contains("button", "Start Inference").should("not.be.disabled")
      .click()
    cy.get("@directoryPickerCancelled").should("be.called")

    cy.setShowDirectoryPickerResult([])
    cy.contains("button", "Start Inference").should("be.not.disabled").click()
    cy.contains(".filetree_filename2.filetree_converting2", /^example-sps-pps-extradata\.mp4/)
    cy.contains(".filetree_filename2.filetree_done2", /^example-sps-pps-extradata\.mp4$/, {timeout: 20 * 60 * 1000})
    cy.contains(".filetree_filename2.filetree_converting2", /^example\.MTS$/)
    cy.contains(".filetree_filename2.filetree_done2", /^example\.MTS$/, {timeout: 20 * 60 * 1000})
    cy.contains(".filetree_filename2.filetree_converting2", /^example2\.mp4/)
    cy.contains(".filetree_filename2.filetree_done2", /^example2\.mp4$/, {timeout: 20 * 60 * 1000})
    const FILES = {
      "example-sps-pps-extradata.mp4": "036ac0f960dfe71c",
      "example.MTS":                   "82f16f09b8327ed1",
      "example2.mp4":                  "549ebe5b4acef5fd",
    } as const

    type FileName = keyof typeof FILES
    type AllGroundTruths = Record<FileName, Record<string, unknown> & {
      framesInfo: ReadonlyArray<{
        detections: ReadonlyArray<Record<string, number>>
      }>}>
    const allGroundTruths: AllGroundTruths = {} as AllGroundTruths
    for (const [filename, hash] of Object.entries(FILES)) {
      const detFileName = filename.replace(/\.[^,]*$/, "") + `.${hash}.behave.det.json`
      cy.assertFileExistsInPickedDirectory(detFileName)
      cy.readFile(`cypress/assets/${detFileName}`, "utf-8").then(res => {
        allGroundTruths[filename as FileName] = res as AllGroundTruths[FileName]
      })
    }
    cy.window().then(win => cy.wrap(null).then(async () => {
      const opfs = await win.navigator.storage.getDirectory()
      const dir = await opfs.getDirectoryHandle("showDirectoryPickerResult")
      for (const [filename, hash] of Object.entries(FILES)) {
        const groundTruth = allGroundTruths[filename as FileName]
        const detFileName = filename.replace(/\.[^,]*$/, "") + `.${hash}.behave.det.json`
        const file = await (await dir.getFileHandle(detFileName)).getFile()
        const data = JSON.parse(await file.text()) as typeof groundTruth
        console.log(await file.text())
        for (const key of Object.keys(groundTruth)) {
          if (key === "sourceFileName") {
            cy.wrap(data[key]).should("equal", filename)
            continue
          }
          if (key !== "framesInfo") {
            cy.wrap(JSON.stringify(data[key])).should(
              "equal", JSON.stringify(groundTruth[key]))
            continue
          }
          // do some fuzzy-match, since values seem to differ a bit between ARM and x86
          // (either because of AI calc, or maybe the WebCodecs Video player is slightly different)
          const nrFrames = groundTruth.framesInfo.length
          expect(data.framesInfo.length).to.equal(nrFrames)
          for (let framenr = 0; framenr < nrFrames; framenr++) {
            const groundDetections = groundTruth.framesInfo[framenr].detections
            const foundDetections = data.framesInfo[framenr].detections
            const compareMap = groundDetections.map(gd => foundDetections.map(fd =>
              Object.keys(gd).every(k => Math.abs(gd[k] - fd[k]) < ALLOWED_DIFFERENCE)
            ))
            cy.wrap(groundDetections.length).should("equal", foundDetections.length)
            cy.wrap(compareMap.every(it => it.some(n => n))).should("be.true")
          }
        }
      }
    }))
    // cy.wait("@postTic").its("request.body").then($body => {
    //   cy.wrap($body).its("id").should("equal", "page-views")
    //   cy.wrap($body).its("projectId").should("equal", "agV6GnAAVoIvJDuW")
    //   cy.wrap($body).its("parameters.path").should("equal", "/app/infer.html")
    // })
    // cy.wait("@postTic").its("request.body").then($body => {
    //   cy.wrap($body).its("id").should("equal", "infer-done")
    //   cy.wrap($body).its("projectId").should("equal", "agV6GnAAVoIvJDuW")
    //   cy.wrap($body).its("parameters.extension").should("equal", "MTS")
    //   cy.wrap($body).its("parameters.filesize").should("equal", "XS (<100MB)")
    // })
    cy.contains("Some infer sessions seem to have failed.", {timeout: 20 * 60 * 1000})
    cy.visitWithStubbedFileSystem("/app/infer.html")
    cy.setShowOpenFilePickerResult([
      // NOTE: Make sure file.MTS is alphabetically first
      {pickerPath: "test/example.MTS", localPath: "cypress/assets/example.MTS"},
      {pickerPath: "test/example2.mp4", localPath: "cypress/assets/example2.mp4"},
      {pickerPath: "test/example-sps-pps-extradata.mp4", localPath: "cypress/assets/example-sps-pps-extradata.mp4"},
      {pickerPath: "test/not-an-mts-file.MTS", localPath: "cypress/assets/other.txt"},
      {pickerPath: "test/file2.82f16f09b8327ed1.behave.mp4", localPath: "cypress/assets/example.MTS"},
      {pickerPath: "test/not-an-mts-file.MTS", localPath: "cypress/assets/other.txt"},
      "cypress/assets/other.txt",
    ])
    cy.contains("button", "Add Files").click()
    cy.contains("button", "Start Inference").should("not.be.disabled")
      .click()
    cy.contains(".filetree_filename2", /^example.MTS/)
      .pseudoElementContaining("after", "Target file already exists")
    cy.contains(".filetree_filename2", /^example2.mp4/)
      .pseudoElementContaining("after", "Target file already exists")
  })
})
