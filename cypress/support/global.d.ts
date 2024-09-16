import {Files} from "./commands"

declare global {
  namespace Cypress {
    interface Chainable<Subject = any> {
      /**
       * Custom command to set which files should be returned to a showOpenFilePicker()
       *
       * Give `null` as first paramter to simulate cancel of the showOpenFilePicker method
       */
      setShowOpenFilePickerResult(files: Files): Chainable<string>;
      /**
       * Custom command to set which files should be returned to a showDirectoryPicker()
       *
       * Give `null` as first paramter to simulate cancel of the showDirectoryPicker method
       */
      setShowDirectoryPickerResult(files: Files): Chainable<string>;
      assertFileExistsInPickedDirectory(filename: string): Chainable<string>;
      /**
       * Custom command to visit with a stubbed file system.
       */
      visitWithStubbedFileSystem(url: string, options?: Partial<Cypress.VisitOptions> | undefined): Chainable<string>;
      visitWithStubbedFileSystem(url: {url: string} & Partial<Cypress.VisitOptions>): Chainable<string>;
      visitWithStubbedFileSystem(url: string | {url: string} & Partial<Cypress.VisitOptions>, options?: Partial<Cypress.VisitOptions> | undefined): Chainable<string>;

    /**
     * Custom query to get the content of :before or :after pseudo-element.
     * This will return the content text of the pseudo-element.
     * @param pseudo - Either 'before' or 'after' to select the pseudo-element.
     * @example
     *    cy.get('selector').pseudoElementContent('before').then(content => ...)
     */
    pseudoElementContent(pseudo: 'before' | 'after'): Chainable<string>;
    }
  }
}

export {};
