describe('Behave UI test', () => {
  it('Can start Behave UI', () => {
    cy.visit('/app/index.html')
    .get('a[href="viewer.html"]')
    .click()
    cy.document()
    .contains("h2", "Welcome to Behave")
  })
  it('Changes visuals on file drag', () => {
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
  it("Can start a behave", () => {
    cy.visitWithStubbedFileSystem("/app/viewer.html")
    cy.setShowOpenFilePickerResult([
      {pickerPath: "test/example.82f16f09b8327ed1.behave.mp4", localPath: "cypress/assets/example.82f16f09b8327ed1.behave.mp4"},
      {pickerPath: "example.82f16f09b8327ed1.behave.det.json", localPath: "cypress/assets/example.82f16f09b8327ed1.behave.det.json"},
    ])
    cy.contains("button", "Start").should("be.disabled")
    cy.contains("button", "Add files").should("not.be.disabled")
      .click()
    cy.contains(".uploader_file_list", /example\.82f16f09b8327ed1\.behave\.det\.json/)
    cy.contains(".uploader_file_list", /example\.82f16f09b8327ed1\.behave\.mp4/)
    cy.contains(".uploader_file_list", /hash: 82f16f09b8327ed1/, {timeout: 20 * 1000})
    cy.contains("button", "Start").should("not.be.disabled")
      .click()

    cy.get("body")
      .contains("Framenumber: 0")
    cy.get("body")
      .contains("Subjects")

    cy.log("Trying cancelling choosing a directory for the behave file")
    cy.setShowSaveFilePickerResult(null)
    cy.window().then(win => {
      cy.spy(win.console, "warn")
        .withArgs("Save file selection cancelled, not creating behaviour file")
        .as("directoryPickerCancelled")
    })
    cy.get("@directoryPickerCancelled").should("not.be.called")
    cy.get("body")
      .contains("button", "Create new behaviour file")
      .click()
    cy.get("@directoryPickerCancelled").should("be.called")
    cy.setShowSaveFilePickerResult([{pickerPath: "example.82f16f09b8327ed1.behave", localPath: "cypress/assets/empty"}])
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

    cy.get(".viewer_controlpanel")
      .contains("Framenumber: 10")

    cy.get('button[title="previous behaviour line"]').click()
    cy.listMatch(".behaviour_table tbody tr.behaviour_selectedLine td",
    [/^0$/, /^03-07-2021$/, /^00:55:03$/, /^Andrea/, /^Climbing$/, /^$/])
    cy.get(".viewer_controlpanel")
      .contains("Framenumber: 0")

    cy.get('button[title="remove the selected behaviour line"]').click()
    cy.get(".viewer_controlpanel")
      .contains("Framenumber: 0")
    cy.get(".behaviour_table tbody tr.behaviour_selectedLine")
      .should("not.exist")
    
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
    cy.get(".behaviour_table tbody tr").eq(2).click()
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
  })
})
