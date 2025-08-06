import { assert, hexDump, range } from "../lib/util";
import { ISODateTimeString } from "../lib/datetime";
import type { LibAVTypes } from "../lib/libavjs";
import { parseSpsNalUnit, SpsCore } from "./avcc-parser";

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
  isInterlacedStream: boolean
  isInterlacedBottomSlice: boolean
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
  if (isAnnexB) {
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
            yield packet.data.slice(nalStartedAt,
              i - nrOfZeroes)
          }
          const nalType = packet.data.at(i + 1)! & 0x1f
          if (nalType === 0x01 || nalType === 0x05) {
            // last NAL, no need to continue
            yield packet.data.slice(i + 1)
            return
          }
          nalStartedAt = i + 1
        }
      }
      nrOfZeroes = 0
    }
    yield packet.data.slice(nalStartedAt)
  } else {
    const assumedLengthBytes = 4
    let pointer = 0
    while (true) {
      if (pointer === packet.data.byteLength) {
        return
      }
      assert(packet.data.byteLength > pointer + assumedLengthBytes)
      const nalLength = range(assumedLengthBytes).reduce((acc, i) =>
        acc + (packet.data[pointer + i] << (8 * (assumedLengthBytes - i - 1))))
      assert(packet.data.byteLength >= pointer + assumedLengthBytes + nalLength)
      yield packet.data.slice(
        pointer + assumedLengthBytes, 
        pointer + assumedLengthBytes + nalLength)
      pointer += assumedLengthBytes + nalLength
    }
  }
}

class Parser {
  public pos: {byte: number, bit: number}

  constructor(private data: Uint8Array) {
    this.pos = {byte: 0, bit: 0}
  }

  u(nrBits: number): number {
    let bitsToRead = nrBits
    let result = 0 
    while (true) {
      const bitsInByte = 8 - this.pos.bit
      const mask = (1 << bitsInByte) - 1
      const readByte = this.data[this.pos.byte]
      if (readByte === 3
        && this.pos.byte > 2
        && this.data[this.pos.byte - 1] === 0
        && this.data[this.pos.byte - 2] === 0) {
        // remove emulation prevention byte
        this.pos.byte++
        continue
      }
      if (bitsToRead > bitsInByte) {
        result |= (readByte & mask) << (bitsToRead - bitsInByte)
        this.pos.byte++
        this.pos.bit = 0
        bitsToRead -= bitsInByte
      } else {
        result |= (readByte & mask) >> (bitsInByte - bitsToRead)
        this.pos.bit += bitsToRead
        return result
      }
    }
  }

  ue(): number {
    let zeroCount = 0
    while (true) {
      if (this.u(1) === 1) break;
      zeroCount++;
    }
    // Read the remaining bits of the Exp-Golomb code
    return (1 << zeroCount | this.u(zeroCount)) - 1;
  }
}

type SliceHeader = {
    first_mb_in_slice: number
    slice_type: number
    pic_parameter_set_id: number
    frame_num: number
    field_pic_flag: number
    bottom_field_flag: number
}

const parseSliceHeader = (parser: Parser, currentSPS: SpsCore | null): SliceHeader => {
  if (currentSPS === null) {
    throw new Error("Slice before first SPS")
  }
  const first_mb_in_slice = parser.ue()
  const slice_type = parser.ue()
  const pic_parameter_set_id = parser.ue()
  if (currentSPS.separate_colour_plane_flag === 1) {
    const _colour_pane_id = parser.u(2)
  }
  const frame_num = parser.u(currentSPS.log2_max_frame_num_minus4 + 4)
  const field_pic_flag = currentSPS.frame_mbs_only_flag === 0 ? parser.u(1) : 0
  const bottom_field_flag = field_pic_flag ? parser.u(1) : 0
  return {
    first_mb_in_slice,
    slice_type,
    pic_parameter_set_id,
    frame_num,
    field_pic_flag,
    bottom_field_flag,
  }
}

const DUMP_ALL_SLICE_INFO = false

export function extractFrameInfo(
  libav: LibAVTypes.LibAV,
  packet: LibAVTypes.Packet,
  isAnnexB: boolean,
  currentSPS: SpsCore | null
): {frameInfo: FrameInfo, currentSPS: SpsCore | null} {
  const frameInfo: Partial<FrameInfo> = {
    pts: libav.i64tof64(packet.pts!, packet.ptshi!),
    dts: libav.i64tof64(packet.dts!, packet.dtshi!)
  }

  for (const nal of getNALs(packet, isAnnexB)) {
    const parser = new Parser(nal)
    assert(parser.u(1) === 0)
    const ref = parser.u(2)
    const nalType = parser.u(5)
    switch (nalType) {
      case 0x01: {  // coded slice of a non-IDR picture
        const sliceHeader = parseSliceHeader(parser, currentSPS)
        const {slice_type, field_pic_flag, bottom_field_flag} = sliceHeader
        frameInfo.isInterlacedStream =
          currentSPS!.frame_mbs_only_flag === 0 && field_pic_flag === 1
        frameInfo.isInterlacedBottomSlice =
          frameInfo.isInterlacedStream && bottom_field_flag === 1
        switch (slice_type % 5) {
          case 0:
            frameInfo.type = "P"
            break
          case 1:
            frameInfo.type = "B"
            break
          case 2:
            frameInfo.type = "I"
            break
          default:
            throw new Error(`Uknown ${ref} ${nalType}`)
        }
        if (DUMP_ALL_SLICE_INFO) {
          console.log(JSON.stringify({...frameInfo, ...sliceHeader}, null, 4))
        }
      } break
      case 0x05: {  // coded slice of an IDR picture
        frameInfo.type = "IDR"
        const sliceHeader = parseSliceHeader(parser, currentSPS)
        const {field_pic_flag, bottom_field_flag} = sliceHeader
        frameInfo.isInterlacedStream =
          currentSPS!.frame_mbs_only_flag === 0 && field_pic_flag === 1
        frameInfo.isInterlacedBottomSlice =
          frameInfo.isInterlacedStream && bottom_field_flag === 1
        if (DUMP_ALL_SLICE_INFO) {
          console.log(JSON.stringify({...frameInfo, ...sliceHeader}, null, 4))
        }
      } break
      case 0x06: { // Supplemental Enhancement Information (SEI)
        const unescapedNal = removeEscapeSequences(nal) // NOTE: also in non-annexB
        let rest = unescapedNal.slice(1)
        seimessage: while (rest.byteLength) {
          const current = rest
          const type = current.at(0)!
          if (type == 0x80) {
            // padding
            rest = current.slice(1)
            continue
          }
          // variable length field: 0xff means: "255 + next byte"
          let pos = 1
          while (current.at(pos)! === 0xff) {
            pos++
          }
          const length = current.at(pos)! + 0xff * (pos - 1)

          if (length > current.byteLength) {
            console.log("problem with buffer: ", current)
            throw new Error("problem with nal 6")
          }
          rest = current.slice(length + 2)
          if (type !== 5) {
            continue
          }
          if (length < UUID_ISO_IEC_11578_PLUS_MDPM.byteLength) {
            continue
          }
          for (let i=0; i < UUID_ISO_IEC_11578_PLUS_MDPM.byteLength; i++) {
            if (UUID_ISO_IEC_11578_PLUS_MDPM.at(i)! !== current.at(i + 2)!) {
              console.warn("found non-timekeeping SEI message")
              hexDump(current.slice(0, length), undefined, console.warn.bind(console))
              continue seimessage
            }
          }
          const nrItems = current.at(
            2 + UUID_ISO_IEC_11578_PLUS_MDPM.byteLength)!
          if (length !== UUID_ISO_IEC_11578_PLUS_MDPM.byteLength + 1 + nrItems * 5) {
            console.warn(`Seems that there is a different byteLength for the timekeeping record, ignoring it for now.`)
            hexDump(current.slice(0, length), undefined, console.warn.bind(console))
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
      case 0x07: { // SPS
        const unescapedNal = removeEscapeSequences(nal)
        currentSPS = parseSpsNalUnit(unescapedNal)
      } break
    }
  }
  return {
    frameInfo: frameInfo as FrameInfo,
    currentSPS}
}


