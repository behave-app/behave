import { ISODateTimeString } from "../lib/datetime";
import type { LibAVTypes } from "../lib/libavjs";

const UUID_ISO_IEC_11578_PLUS_MDPM = new Uint8Array([
  0x17, 0xee, 0x8c, 0x60, 0xf8, 0x4d, 0x11, 0xd9, 0x8c, 0xd6, 0x08, 0x00, 0x20,
  0x0c, 0x9a, 0x66, 0x4d, 0x44, 0x50, 0x4d
])

export type FrameInfo = {
  timestamp?: ISODateTimeString
  startByte: number,
  pts: number,
  dts: number,
  type: "I" | "IDR" | "P" | "B"
}

function removeEscapeSequences(inputNAL: Uint8Array): Uint8Array {
  const outputNAL = new Uint8Array(inputNAL.length); // Initialize with the same size

  let outputIndex = 0;

  for (let i = 0; i < inputNAL.length; i++) {
    // Check for 0x03 byte
    if (inputNAL[i] === 0x03) {
      // Check the following byte
      if (i + 1 < inputNAL.length && inputNAL[i + 1] <= 0x03 &&
        i >= 2 && inputNAL[i - 1] === 0 && inputNAL[i - 2] === 0
      ) {
        // Skip the escape sequence (0x03)
      } else {
        // If not a valid escape sequence, copy the byte as-is
        outputNAL[outputIndex] = inputNAL[i];
        outputIndex++;
      }
    } else {
      // Copy non-escape sequence bytes as-is
      outputNAL[outputIndex] = inputNAL[i];
      outputIndex++;
    }
  }

  // Create a new Uint8Array with the actual size
  return new Uint8Array(outputNAL.slice(0, outputIndex));
}

export function* getNALs(
  packet: LibAVTypes.Packet,
  isAnnexB: boolean,
  ): Generator<Uint8Array, void, void> {
  if (!isAnnexB) {
    throw new Error("is todo")
  }

  let nrOfZeroes = 0
  let nalStartedAt = NaN

  for (let i = 0; i < packet.data.byteLength ; i++) {
    const byte = packet.data.at(i)!
    if (byte === 0) {
      nrOfZeroes++;
      continue
    }
    if (byte === 1) {
      if (nrOfZeroes >= 2) {
        if (Number.isFinite(nalStartedAt)) {
          yield new Uint8Array(
            packet.data.buffer,
            packet.data.byteOffset + nalStartedAt,
            i - nrOfZeroes - nalStartedAt)
        }
        const nalType = packet.data.at(i + 1)! & 0x1f
        if (nalType === 0x01 || nalType === 0x05) {
          // last NAL, no need to continue
          yield new Uint8Array(
            packet.data.buffer,
            packet.data.byteOffset + i + 1,
            packet.data.byteLength - (i + 1))
          return
        }
        nalStartedAt = i + 1
      }
    }
    nrOfZeroes = 0
  }
  yield new Uint8Array(
    packet.data.buffer,
    packet.data.byteOffset + nalStartedAt,
    packet.data.byteLength - nalStartedAt)
}

export function extractFrameInfo(
  packet: LibAVTypes.Packet,
  isAnnexB: boolean,
): Omit<FrameInfo, "pts" | "dts"> {
  if (!isAnnexB) {
    throw new Error("is todo")
  }
  const frameInfo: Partial<ReturnType<typeof extractFrameInfo>>= {}

  for (const nal of getNALs(packet, isAnnexB)) {
    const firstbyte = nal.at(0)!
    const ref = (firstbyte & 0xe0) >> 5
    const nalType = firstbyte & 0x1f
    switch (nalType) {
      case 0x01: {
        switch (ref) {
          case 0:
            frameInfo.type = "B"
            break
          case 2:
            frameInfo.type = "P"
            break
          case 3:
            frameInfo.type = "I"
            break
          default:
            throw new Error(`Uknown ${ref} ${nalType}`)
        }
      } break
      case 0x05: {
        frameInfo.type = "IDR"
      } break
      case 0x06: {
        const unescapedNal = isAnnexB ? removeEscapeSequences(nal) : nal
        let rest = new Uint8Array(unescapedNal.buffer, unescapedNal.byteOffset + 1)
        while (rest.byteLength) {
          const current = rest
          const type = current.at(0)!
          if (type == 0x80) {
            // padding
            rest = new Uint8Array(current.buffer, current.byteOffset + 1)
            continue
          }
          const length = current.at(1)!
          const newOffset = current.byteOffset + length + 2
          if (newOffset > current.buffer.byteLength) {
            console.log("problem with buffer: ", current.buffer)
            throw new Error("problem with nal 6")
          }
          rest = new Uint8Array(current.buffer, current.byteOffset + length + 2)
          if (type !== 5) {
            continue
          }
          if (length < UUID_ISO_IEC_11578_PLUS_MDPM.byteLength) {
            continue
          }
          for (let i=0; i < UUID_ISO_IEC_11578_PLUS_MDPM.byteLength; i++) {
            if (UUID_ISO_IEC_11578_PLUS_MDPM.at(i)! !== current.at(i + 2)!) {
              console.warn("different nal")
              continue
            }
          }
          const nrItems = current.at(
            2 + UUID_ISO_IEC_11578_PLUS_MDPM.byteLength)!
          if (length !== UUID_ISO_IEC_11578_PLUS_MDPM.byteLength + 1 + nrItems * 5) {
            console.warn("Not sure...")
            continue
          }
          const dataByType: Record<number, number[]> = {}
          const view = new DataView(
            current.buffer, current.byteOffset + 2 + UUID_ISO_IEC_11578_PLUS_MDPM.byteLength + 1)
          for (let itemNr = 0; itemNr < nrItems; itemNr++) {
            const type = view.getUint8(5 * itemNr)
            dataByType[type] = [1, 2, 3, 4].map(i => view.getUint8(5 * itemNr + i))
          }
          if (0x18 in dataByType && 0x19 in dataByType) {
            // strange encoding, where 0x20 --> 20 (decimal)
            const decodeNr = (nr: number) => parseInt(nr.toString(16))
            const [_, century, year2digit, month] = dataByType[0x18].map(decodeNr)
            const offsetRaw = dataByType[0x18][0]
            const [day, hour, min, sec] = dataByType[0x19].map(decodeNr)
            const year = 100 * century + year2digit
            const localHoursOffset = (offsetRaw & 0x40 ? -1 : 1) * (offsetRaw & 0x3f) / 2
            const p2 = (n: number) => n.toString().padStart(2, "0")
            const p4 = (n: number) => n.toString().padStart(4, "0")
            const isoDateString = [p4(year), p2(month), p2(day)].join("-")
            const isoTimeString = [p2(hour), p2(min), p2(sec)].join(":")
            const isoTz = localHoursOffset === 0 ? "Z" :
              `${localHoursOffset > 0 ? "+" : "-"}${p2(Math.floor(Math.abs(localHoursOffset)))}:${p2((Math.abs(localHoursOffset) % 1)*60)}`
            frameInfo.timestamp = `isodate:${isoDateString}T${isoTimeString}${isoTz}` as typeof frameInfo["timestamp"]
          }
        }
      } break
    }
  }
  return frameInfo as ReturnType<typeof extractFrameInfo>
}


