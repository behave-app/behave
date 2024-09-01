describe('App overview', () => {
  it('Has a convert link', () => {
    cy.visit('/')
    .get('a[href="convert.html"]')
    .click()
    cy.document()
    .contains("h1", "Video file convertor")
  })
  it('Changes visuals on file drag', () => {
    cy.visit("/convert.html")
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
  it("Accepts an MTS file", () => {
    cy.visitWithStubbedFileSystem("/convert.html")
    cy.setShowOpenFilePickerResult([
      {pickerPath: "test/file.MTS", localPath: "cypress/assets/example.MTS"},
      {pickerPath: "test/file.mp4", localPath: "cypress/assets/other.txt"},
      "cypress/assets/other.txt",
    ])
    cy.setShowDirectoryPickerResult([])
    cy.contains("button", "Start conversion").should("be.disabled")
    cy.contains("button", "Add files").should("not.be.disabled")
    .click()
    cy.contains(".filetree_filename", /^file\.MTS$/)
    cy.contains(".filetree_filename", /^other\.txt/).should("not.exist")
    cy.contains(".filetree_filename", /^file\.mp4/).should("not.exist")
    // TODO: test cancel directotyPicker
    cy.contains("button", "Start conversion").should("not.be.disabled")
    .click()
    cy.contains(".filetree_filename.filetree_converting", /^file\.MTS$/)
    cy.contains(".filetree_filename.filetree_done", /^file\.MTS$/, {timeout: 60000})
    cy.assertFileExistsInPickedDirectory("file.82f16f09b8327ed1.behave.mp4")
  })
})
