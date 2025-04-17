import {Files} from "./commands"

declare global {
  namespace Cypress {
    interface Chainable {
      task(
        eventName: 'splitFileIntoParts',
        args: { fileName: string; maxSize: number },
        options?: Partial<Loggable & Timeoutable>
      ): Chainable<ReadonlyArray<string>>;
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
     * Custom query to get the content of :before or :after pseudo-element.
     * This will return the content text of the pseudo-element.
     * @param pseudo - Either 'before' or 'after' to select the pseudo-element.
     * @example
     *    cy.get('selector').pseudoElementContent('before').then(content => ...)
     */
      pseudoElementContent(pseudo: 'before' | 'after'): Chainable<string>;

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
