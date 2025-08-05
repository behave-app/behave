import {Files} from "./commands"

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to set which files should be returned to a showOpenFilePicker()
       *
       * Give `null` as first paramter to simulate cancel of the showOpenFilePicker method
       */
      setShowOpenFilePickerResult(files: Files): Chainable<string>;
      /**
       * Custom command to set which file should be returned to a showSaveFilePicker()
       */
      setShowSaveFilePickerResult(method: typeof showSaveFilePicker);
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
     * Custom query to get the elements with a certain after of before value
     * @param pseudo - Either 'before' or 'after' to select the pseudo-element.
     * @param containing - String to regex to match against
     */
      pseudoElementContaining(
        pseudo: 'before' | 'after',
        containing: string | RegExp,
        options?: Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & {allowEmpty: boolean}>
      ): Chainable<JQuery<HTMLElement>>;
      /**
       * Check that a list of elements matches a list of regexs
       * @param listSelector - A string which, if given to `cy.get` returns a list of elements
      * @param expected - A list of regexes to match on the elements.
      */
      listMatch(listSelector: string, expected: RegExp[])
    }
  }
}

export {};
