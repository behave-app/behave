describe('App overview', () => {
  it('Has three links', () => {
    cy.visit('/app/index.html')
    .get("a")
    .should("have.length", 3)
  })
})
