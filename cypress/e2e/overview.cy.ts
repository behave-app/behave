describe('App overview', function () {
  beforeEach(function () {
    cy.intercept("https://getinsights.io/app/tics", {"ok":true}).as("postTic")
  })

  it ('Shows a header and footer', function () {
    cy.visit('/')
    cy.contains("h1", "BEHAVE")
    cy.contains("h2", "Behaviour Extraction by Humans and AI from Video")
    cy.contains("MIT licensed")
    cy.contains(".version", "Version")
    cy.get('img[alt="logo"]')
  })

  it('Has three links', function () {
    cy.visit('/app/index.html')
    cy.get('a[href="convert.html"]')
    cy.get('a[href="infer.html"]')
    cy.get('a[href="viewer.html"]')
  })
})
