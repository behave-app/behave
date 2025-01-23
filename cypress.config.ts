import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    setupNodeEvents(on, _config) {
      on('task', {
        log(message) {
          console.log(message)

          return null
        },
      })

    },
    fileServerFolder: "public",
  },
});
