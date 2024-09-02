describe('App overview', () => {
  it('Has three links', () => {
    cy.visit('/app/index.html')
      cy.get('a[href="convert.html"]')
      cy.get('a[href="infer.html"]')
      cy.get('a[href="viewer.html"]')
  })
})
