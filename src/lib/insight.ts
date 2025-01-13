const MB = 1024 * 1024;
export function tic(file: File, insightKey: string) {
  window.insights.track({
    id: insightKey,
    parameters: {
      extension: file.name.split(".").at(-1)!,
      filesize: file.size < 100 * MB ? "XS (<100MB)"
        : file.size < 500 * MB ? "S (<500MB)"
          : file.size < 1000 * MB ? "M (<1000MB)"
            : file.size < 2000 * MB ? "L (<2000MB)"
              : file.size < 4000 * MB ? "XL (<4000MB)" : "XXL (>4000MB)"
    }
  })
}
