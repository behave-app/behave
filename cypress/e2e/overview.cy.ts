describe('App overview', () => {
  it('Has three links', () => {
    cy.visit('/')
    .get("a")
    .should("have.length", 3)
  })
})
