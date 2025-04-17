import { defineConfig } from "cypress";
import { statSync, mkdtempSync, rmSync, openSync, readSync, closeSync, writeFileSync} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let tmpdirs: string[] = []

export default defineConfig({
  e2e: {
    viewportWidth: 1280,
    viewportHeight: 720,
    fileServerFolder: "public",
    setupNodeEvents(on, _config) {
      on('task', {
        log(message) {
          console.log(message)

          return null
        },
        splitFileIntoParts({fileName, maxSize, ...rest}: {fileName: string, maxSize: number}): ReadonlyArray<string> {
          if (Object.keys(rest).length > 0) {
            throw new Error(`unexpected parameters: ${JSON.stringify(rest)}`)
          }
          const stats = statSync(fileName);
          const totalSize = stats.size;
          console.log(totalSize)

          if (totalSize <= maxSize) {
            return [fileName]
          }

          // Create a temporary directory for storing parts
          const tempDir = mkdtempSync(join(tmpdir(), 'split-'));
          tmpdirs.push(tempDir)
          const parts: string[] = [];

          let currentPart: number = 0;

          const fileBuffer = Buffer.allocUnsafe(maxSize);
          const readFd = openSync(fileName, 'r');

          let bytesRead: number;
          let position = 0;

          do {
            bytesRead = readSync(readFd, fileBuffer, 0, maxSize, position);
            if (bytesRead > 0) {
              const partPath = join(tempDir, `part-${currentPart++}`);
              writeFileSync(partPath, fileBuffer.slice(0, bytesRead));
              parts.push(partPath);
              position += bytesRead;
            }
          } while (bytesRead > 0);

          closeSync(readFd);

          return parts
        },
        splitCleanUp() {
          for (const tempDir of tmpdirs) {
            rmSync(tempDir, { recursive: true });
          }
          tmpdirs = []
          return true
        },
      })
    },
  },
});
