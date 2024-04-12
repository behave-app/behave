declare const LIBAVJS_COMMIT: string
import type * as LibAVTypes from "../../public/app/bundled/libavjs/dist/libav.types.d.ts"

export async function getLibAV() {
  return (await import(`../../app/bundled/libavjs-${LIBAVJS_COMMIT}/libav-behave.dbg.mjs`)).default as LibAVTypes.LibAVWrapper
}
export {LibAVTypes}
