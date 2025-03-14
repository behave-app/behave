import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    viewportWidth: 1280,
    viewportHeight: 720,
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
