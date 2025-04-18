import { EXTENSIONS } from "../lib/constants"
import {assert, enumerate} from "../lib/util"

function getTrackId(data: DataView<ArrayBuffer>): number {
  const asciiDecoder = new TextDecoder("ascii")
  const length = data.getUint32(0, /*is_little_endian*/ false)
  const name = asciiDecoder.decode(data.buffer.slice(4, 8))
  assert(name === "tkhd", `Must have a track header, got $(name)`)
  assert(length >= 32)
  const version = data.getUint8(8)
  const timeSize = version === 0 ? 4 : 8
  const trackId = data.getUint32(12 + 2 * timeSize, /*is_little_endian*/ false)
  return trackId
}

type BoxInfo = {
  boxStartPointer: number,
  contentStartPointer: number,
  endPointer: number,
  name: string
}

async function getAtom(
  blob: Blob,
      startPointer: number,
      endPointer: number,
      to_get: ReadonlyArray<string>,
      getMultiple?: boolean | undefined,
    ): Promise<ReadonlyArray<BoxInfo>> 
    {
  const asciiDecoder = new TextDecoder("ascii")
  const result: BoxInfo[] = []
  let pointer = startPointer
  while (pointer !== endPointer) {
    const bytesLeft = endPointer - pointer
    assert (bytesLeft >=8, `${bytesLeft} bytes left`)
    const data = new DataView(await blob.slice(pointer, pointer + Math.min(16, bytesLeft)).arrayBuffer())
    let length = data.getUint32(0, /*is_little_endian*/ false)
    const name = asciiDecoder.decode(data.buffer.slice(4, 8))
    if (length === 1) {
      assert (bytesLeft >=16, `${bytesLeft} bytes left`)
      const biglength = data.getBigUint64(8)
      assert(biglength <= Number.MAX_SAFE_INTEGER, `box length = ${biglength}`)
      length = Number(biglength)
    }
    if (length === 0) {
      length = endPointer - pointer
    }
    if (to_get[0].indexOf(name) !== -1) {
      result.push({
        boxStartPointer: pointer,
        contentStartPointer: pointer + 8,
        endPointer: pointer + length,
        name})
      if (getMultiple !== true) {
        return result
      }
    }
    pointer += length
  }
  return result
}

export type TTSBox = {
  version: number
  flags: number
  entryCount: number
  entries: ArrayBuffer
}

function parseTTSBox(
  data: DataView<ArrayBuffer>
): {type: "stts" | "ctts", box: TTSBox} {
  const asciiDecoder = new TextDecoder("ascii")
  const length = data.getUint32(0, /*is_little_endian*/ false)
  assert(length === data.byteLength)
  const name = asciiDecoder.decode(data.buffer.slice(4, 8))
  const versionAndFlags = data.getUint32(8, /*is_little_endian*/ false)
  const version = versionAndFlags >> 24
  const flags = versionAndFlags && 0xFFFFFF
  assert (name === "stts" || name === "ctts")
  const entryCount = data.getUint32(12, /*is_little_endian*/ false)
  const entries = data.buffer.slice(16)
  assert(entryCount * 8 === entries.byteLength)
  return {type: name, box: {version, flags, entryCount, entries}}
}

export async function extractSttsAndCttsBox(
  file: File, track: {trackId: number} | {index: number}
): Promise<{stts?: TTSBox, ctts?: TTSBox}> {
  const result: {stts?: TTSBox, ctts?: TTSBox} = {}
    assert(file.name.toLowerCase().endsWith(
      EXTENSIONS.videoFileMp4.toLowerCase()))
  const moovData = await getAtom(file, 0, file.size, ["moov"])
  assert(moovData.length === 1)
  const tracksData = await getAtom(
    file, moovData[0].contentStartPointer, moovData[0].endPointer, ["trak"], true)
  for (const [index, trackData] of enumerate(tracksData)) {
    if ("index" in track) {
      if (index !== track.index) {
        continue
      }
    } else {
      const headerData = await getAtom(
        file, trackData.contentStartPointer, trackData.endPointer, ["tkhd"])
      assert(headerData.length === 1)
      const foundTrackId = getTrackId(new DataView(
        await file.slice(headerData[0].contentStartPointer, headerData[0].endPointer)
        .arrayBuffer()
      ))
      if (foundTrackId !== track.trackId) {
        continue
      }
    }
    let boxData = [trackData] as ReadonlyArray<typeof trackData>
    for (const atom of ["mdia", "minf", "stbl"]) {
      boxData = await getAtom(
        file, boxData[0].contentStartPointer, boxData[0].endPointer, [atom])
      assert(boxData.length === 1, `missing ${atom} atom`)
    }
    const ttsBoxesData = await getAtom(
      file, boxData[0].contentStartPointer, boxData[0].endPointer, ["stts", "ctts"], true)
    for (const ttsBoxData of ttsBoxesData) {
      const data = new DataView(
        await file.slice(ttsBoxData.boxStartPointer, ttsBoxData.endPointer).arrayBuffer())
      const {type, box} = parseTTSBox(data)
      assert(!(type in result))
      result[type] = box
    }
    return result
  }
  throw new Error(`No track found for ${JSON.stringify(track)}`)
}
