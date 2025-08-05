describe('Conversion test', function () {
  beforeEach(function () {
    cy.intercept("https://getinsights.io/app/tics", {"ok":true}).as("postTic")
  })

  it('Has a convert link', function () {
    cy.visit('/app/index.html')
    .get('a[href="convert.html"]')
    .click()
    cy.document()
    .contains("h1", "Video file convertor")
  })

  it('Changes visuals on file drag', function () {
    cy.visit("/app/convert.html")
    .get("body")
    .should("not.contain", "Drop files here")
    .trigger("dragenter")
    .should("contain", "Drop files here")
    .get(".upload_fullScreenDropInfo")
    .trigger("dragenter")
    .should("contain", "Drop files here")
    .trigger("dragleave")
    .should("contain", "Drop files here")
    cy.document()
    .get("body")
    .trigger("dragleave")
    .should("not.contain", "Drop files here")
  })

  it("Converts an MTS file", function () {
    cy.visitWithStubbedFileSystem("/app/convert.html")
    cy.setShowOpenFilePickerResult([
      {pickerPath: "test/file.MTS", localPath: "cypress/assets/example.MTS"},
      {pickerPath: "test/file.mp4", localPath: "cypress/assets/other.txt"},
      "cypress/assets/other.txt",
    ])
    cy.contains("button", "Start Conversion").should("be.disabled")
    cy.contains("button", "Add Files").should("not.be.disabled")
      .click()
    cy.contains(".filetree_filename", /^file\.MTS$/)
    cy.contains(".filetree_filename", /^other\.txt/)
      .pseudoElementContaining("after", "Filetype not supported")
    cy.contains(".filetree_filename", /^file\.mp4/)
      .pseudoElementContaining("after", "Filetype not supported")
    cy.contains("You have added some files with an unsupported extension.")
    cy.contains("Some converts seem to have failed.").should("not.exist")

    cy.setShowDirectoryPickerResult(null)
    cy.window().then(win => {
      cy.spy(win.console, "warn")
        .withArgs("Directory selection aborted, nothing happened")
        .as("directoryPickerCancelled")
    })
    cy.get("@directoryPickerCancelled").should("not.be.called")
    cy.contains("button", "Start Conversion").should("not.be.disabled")
      .click()
    cy.get("@directoryPickerCancelled").should("be.called")

    cy.setShowDirectoryPickerResult([])
    cy.contains("button", "Start Conversion").should("not.be.disabled")
      .click()
    cy.contains(".filetree_filename.filetree_converting", /^file\.MTS$/)
    cy.contains(".filetree_filename.filetree_done", /^file\.MTS$/, {timeout: 60000})
    cy.assertFileExistsInPickedDirectory("file.82f16f09b8327ed1.behave.mp4")
    // cy.wait("@postTic").its("request.body").then($body => {
    //   cy.wrap($body).its("id").should("equal", "page-views")
    //   cy.wrap($body).its("projectId").should("equal", "agV6GnAAVoIvJDuW")
    //   cy.wrap($body).its("parameters.path").should("equal", "/app/convert.html")
    // })
    // cy.wait("@postTic").its("request.body").then($body => {
    //   cy.wrap($body).its("id").should("equal", "convert-done")
    //   cy.wrap($body).its("projectId").should("equal", "agV6GnAAVoIvJDuW")
    //   cy.wrap($body).its("parameters.extension").should("equal", "MTS")
    //   cy.wrap($body).its("parameters.filesize").should("equal", "XS (<100MB)")
    // })

    cy.visitWithStubbedFileSystem("/app/convert.html")
    cy.contains("button", "Add Files").should("not.be.disabled")
      .click()
    cy.contains("button", "Start Conversion").should("not.be.disabled")
      .click()
    cy.contains(".filetree_filename", /^file.MTS/)
      .pseudoElementContaining("after", "Target file already exists")
    cy.contains("button", "Overwrite").click()
    cy.contains(".filetree_filename.filetree_converting", /^file\.MTS$/)
    cy.contains(".filetree_filename.filetree_done", /^file\.MTS$/, {timeout: 60000})
  })

  it("Displays a convert error and explanantion if convert fails", function () {
    cy.visitWithStubbedFileSystem("/app/convert.html")
    cy.setShowOpenFilePickerResult([
      {pickerPath: "test/file.MTS", localPath: "cypress/assets/other.txt"},
    ])
    cy.contains("button", "Start Conversion").should("be.disabled")
    cy.contains("button", "Add Files").should("not.be.disabled")
      .click()
    cy.contains("You have added some files with an unsupported extension.").should("not.exist")
    cy.contains("button", "Start Conversion").should("not.be.disabled")
      .click()
    cy.contains("Some converts seem to have failed.")
  })
})
