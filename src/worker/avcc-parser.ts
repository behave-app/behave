/* avcc-parser.ts
 * Strict parser for AVCDecoderConfigurationRecord ("avcC") and SPS NAL units.
 * Expects the raw avcC payload (NOT including the MP4 box header).
 */

/* =========================
 * Types
 * ========================= */

export interface NALUnit {
  length: number;
  data: Uint8Array; // includes 1-byte NAL header
  header: {
    forbidden_zero_bit: 0 | 1;
    nal_ref_idc: number;   // 0..3
    nal_unit_type: number; // 1..31
  };
}

export interface HighProfileFields {
  chroma_format: 0 | 1 | 2 | 3;
  bit_depth_luma_minus8: number;   // usually 0..6 (8..14 bit)
  bit_depth_chroma_minus8: number; // usually 0..6 (8..14 bit)
  numOfSequenceParameterSetExt: number;
  sequenceParameterSetExt: NALUnit[];
}

export interface AvcDecoderConfigurationRecord {
  configurationVersion: 1;
  AVCProfileIndication: number;    // 0..255
  profile_compatibility: number;   // 0..255
  AVCLevelIndication: number;      // 0..255
  lengthSizeMinusOne: 0 | 1 | 2 | 3; // NAL length field size = value+1
  numOfSequenceParameterSets: number; // 1..31
  sequenceParameterSets: NALUnit[];
  numOfPictureParameterSets: number;  // 1..255 (spec uses 8-bit)
  pictureParameterSets: NALUnit[];
  highProfileFields?: HighProfileFields;
}

export type PartialAvcC = Partial<AvcDecoderConfigurationRecord>;

/* =========================
 * avcC Errors
 * ========================= */

export class ParseAvcCError extends Error {
  readonly partial?: PartialAvcC;
  readonly remaining?: Uint8Array;
  readonly offset?: number;
  constructor(message: string, opts?: { partial?: PartialAvcC; remaining?: Uint8Array; offset?: number }) {
    super(message);
    this.name = this.constructor.name;
    this.partial = opts?.partial;
    this.remaining = opts?.remaining;
    this.offset = opts?.offset;
  }
}

export class AvcCVersionError extends ParseAvcCError {}
export class ReservedBitsError extends ParseAvcCError {}
export class LengthOutOfRangeError extends ParseAvcCError {}
export class CountConstraintError extends ParseAvcCError {}
export class TruncatedError extends ParseAvcCError {}
export class NalUnitTypeError extends ParseAvcCError {}
export class TrailingDataError extends ParseAvcCError {}
export class ProfileExtensionError extends ParseAvcCError {}

/* =========================
 * avcC helpers
 * ========================= */

function expectBytesAvailable(total: Uint8Array, offset: number, needed: number, partial?: PartialAvcC): void {
  if (offset + needed > total.length) {
    throw new TruncatedError(
      `Unexpected end of data: need ${needed} byte(s) at offset ${offset}, only ${total.length - offset} remain.`,
      { partial, remaining: total.subarray(offset), offset }
    );
  }
}

function readU8(buf: Uint8Array, offset: number, partial?: PartialAvcC): { value: number; offset: number } {
  expectBytesAvailable(buf, offset, 1, partial);
  return { value: buf[offset], offset: offset + 1 };
}

function readU16BE(buf: Uint8Array, offset: number, partial?: PartialAvcC): { value: number; offset: number } {
  expectBytesAvailable(buf, offset, 2, partial);
  const value = (buf[offset] << 8) | buf[offset + 1];
  return { value, offset: offset + 2 };
}

function readBytes(buf: Uint8Array, offset: number, len: number, partial?: PartialAvcC): { value: Uint8Array; offset: number } {
  expectBytesAvailable(buf, offset, len, partial);
  return { value: buf.subarray(offset, offset + len), offset: offset + len };
}

function parseNalHeaderByte(byte: number) {
  const forbidden_zero_bit = ((byte >> 7) & 0x01) as 0 | 1;
  const nal_ref_idc = (byte >> 5) & 0x03;
  const nal_unit_type = byte & 0x1F;
  return { forbidden_zero_bit, nal_ref_idc, nal_unit_type };
}

function parseNalUnit(buf: Uint8Array, offset: number, expectedType: number, partial?: PartialAvcC) {
  const { value: length, offset: o1 } = readU16BE(buf, offset, partial);
  if (length <= 0) {
    throw new LengthOutOfRangeError(`NAL unit length must be > 0 (got ${length}) at offset ${offset}.`, {
      partial,
      remaining: buf.subarray(o1),
      offset,
    });
  }
  const { value: data, offset: o2 } = readBytes(buf, o1, length, partial);
  const header = parseNalHeaderByte(data[0]);
  if (header.forbidden_zero_bit !== 0) {
    throw new NalUnitTypeError(`NAL forbidden_zero_bit must be 0 (got ${header.forbidden_zero_bit}).`, {
      partial,
      remaining: buf.subarray(o2),
      offset,
    });
  }
  if (header.nal_unit_type !== expectedType) {
    throw new NalUnitTypeError(`Unexpected NAL unit type: expected ${expectedType}, got ${header.nal_unit_type}.`, {
      partial,
      remaining: buf.subarray(o2),
      offset,
    });
  }
  return {
    nal: { length, data, header } as NALUnit,
    offset: o2,
  };
}

function parseNalUnitExt(buf: Uint8Array, offset: number, partial?: PartialAvcC) {
  // SPS extension NALs are type 13
  const expectedType = 13;
  const { value: length, offset: o1 } = readU16BE(buf, offset, partial);
  if (length <= 0) {
    throw new LengthOutOfRangeError(`SPS extension length must be > 0 (got ${length}) at offset ${offset}.`, {
      partial,
      remaining: buf.subarray(o1),
      offset,
    });
  }
  const { value: data, offset: o2 } = readBytes(buf, o1, length, partial);
  const header = parseNalHeaderByte(data[0]);
  if (header.forbidden_zero_bit !== 0) {
    throw new NalUnitTypeError(`SPS extension forbidden_zero_bit must be 0 (got ${header.forbidden_zero_bit}).`, {
      partial,
      remaining: buf.subarray(o2),
      offset,
    });
  }
  if (header.nal_unit_type !== expectedType) {
    throw new NalUnitTypeError(`Unexpected NAL unit type in SPS extension: expected ${expectedType}, got ${header.nal_unit_type}.`, {
      partial,
      remaining: buf.subarray(o2),
      offset,
    });
  }
  return {
    nal: { length, data, header } as NALUnit,
    offset: o2,
  };
}

/* =========================
 * Public avcC API
 * ========================= */

export function parseAvcDecoderConfigurationRecord(input: Uint8Array): { record: AvcDecoderConfigurationRecord; remaining: Uint8Array } {
  const partial: PartialAvcC = {};
  let offset = 0;

  // configurationVersion
  let rv = readU8(input, offset, partial);
  const configurationVersion = rv.value;
  offset = rv.offset;
  if (configurationVersion !== 1) {
    throw new AvcCVersionError(`configurationVersion must be 1 (got ${configurationVersion}).`, {
      partial, remaining: input.subarray(offset), offset,
    });
  }
  partial.configurationVersion = 1 as const;

  // profile / compat / level
  rv = readU8(input, offset, partial);
  const AVCProfileIndication = rv.value; offset = rv.offset;
  partial.AVCProfileIndication = AVCProfileIndication;

  rv = readU8(input, offset, partial);
  const profile_compatibility = rv.value; offset = rv.offset;
  partial.profile_compatibility = profile_compatibility;

  rv = readU8(input, offset, partial);
  const AVCLevelIndication = rv.value; offset = rv.offset;
  partial.AVCLevelIndication = AVCLevelIndication;

  // reserved(6)=111111 + lengthSizeMinusOne(2)
  rv = readU8(input, offset, partial);
  const lenByte = rv.value; offset = rv.offset;
  const reserved6 = (lenByte >> 2) & 0x3F;
  const lengthSizeMinusOne = (lenByte & 0x03) as 0 | 1 | 2 | 3;
  if (reserved6 !== 0x3F) {
    throw new ReservedBitsError(`Reserved bits before lengthSizeMinusOne must be 111111b. Got 0x${reserved6.toString(16)}.`, {
      partial, remaining: input.subarray(offset), offset,
    });
  }
  if (lengthSizeMinusOne < 0 || lengthSizeMinusOne > 3) {
    throw new LengthOutOfRangeError(`lengthSizeMinusOne must be in [0..3] (got ${lengthSizeMinusOne}).`, {
      partial, remaining: input.subarray(offset), offset,
    });
  }
  partial.lengthSizeMinusOne = lengthSizeMinusOne;

  // reserved(3)=111 + numOfSPS(5)
  rv = readU8(input, offset, partial);
  const spsCountByte = rv.value; offset = rv.offset;
  const reserved3 = (spsCountByte >> 5) & 0x07;
  const numOfSequenceParameterSets = spsCountByte & 0x1F;
  if (reserved3 !== 0x07) {
    throw new ReservedBitsError(`Reserved bits before numOfSequenceParameterSets must be 111b. Got 0x${reserved3.toString(16)}.`, {
      partial, remaining: input.subarray(offset), offset,
    });
  }
  if (numOfSequenceParameterSets < 1) {
    throw new CountConstraintError(`numOfSequenceParameterSets must be >= 1 (got ${numOfSequenceParameterSets}).`, {
      partial, remaining: input.subarray(offset), offset,
    });
  }
  partial.numOfSequenceParameterSets = numOfSequenceParameterSets;

  // SPS list
  const sequenceParameterSets: NALUnit[] = [];
  for (let i = 0; i < numOfSequenceParameterSets; i++) {
    const res = parseNalUnit(input, offset, /*expectedType=*/7, partial);
    sequenceParameterSets.push(res.nal);
    offset = res.offset;
  }
  partial.sequenceParameterSets = sequenceParameterSets;

  // PPS count (8-bit)
  rv = readU8(input, offset, partial);
  const numOfPictureParameterSets = rv.value; offset = rv.offset;
  if (numOfPictureParameterSets < 1) {
    throw new CountConstraintError(`numOfPictureParameterSets must be >= 1 (got ${numOfPictureParameterSets}).`, {
      partial, remaining: input.subarray(offset), offset,
    });
  }
  partial.numOfPictureParameterSets = numOfPictureParameterSets;

  // PPS list
  const pictureParameterSets: NALUnit[] = [];
  for (let i = 0; i < numOfPictureParameterSets; i++) {
    const res = parseNalUnit(input, offset, /*expectedType=*/8, partial);
    pictureParameterSets.push(res.nal);
    offset = res.offset;
  }
  partial.pictureParameterSets = pictureParameterSets;

  // Optional High-profile tail
  const profileForExt = new Set([100, 110, 122, 144]);
  let highProfileFields: HighProfileFields | undefined;

  if (profileForExt.has(AVCProfileIndication) && (input.length - offset) >= 4) {
    expectBytesAvailable(input, offset, 4, partial);

    // Byte 0: reserved(6)=111111 + chroma_format(2)
    let b = input[offset++];
    const r6a = (b >> 2) & 0x3F;
    if (r6a !== 0x3F) {
      throw new ReservedBitsError(`High-profile reserved bits (first 6) must be 111111b. Got 0x${r6a.toString(16)}.`, {
        partial, remaining: input.subarray(offset), offset,
      });
    }
    const chroma_format = (b & 0x03) as 0 | 1 | 2 | 3;

    // Byte 1: reserved(5)=11111 + bit_depth_luma_minus8(3)
    b = input[offset++];
    const r5b = (b >> 3) & 0x1F;
    if (r5b !== 0x1F) {
      throw new ReservedBitsError(`High-profile reserved bits before bit_depth_luma_minus8 must be 11111b. Got 0x${r5b.toString(16)}.`, {
        partial, remaining: input.subarray(offset), offset,
      });
    }
    const bit_depth_luma_minus8 = b & 0x07;

    // Byte 2: reserved(5)=11111 + bit_depth_chroma_minus8(3)
    b = input[offset++];
    const r5c = (b >> 3) & 0x1F;
    if (r5c !== 0x1F) {
      throw new ReservedBitsError(`High-profile reserved bits before bit_depth_chroma_minus8 must be 11111b. Got 0x${r5c.toString(16)}.`, {
        partial, remaining: input.subarray(offset), offset,
      });
    }
    const bit_depth_chroma_minus8 = b & 0x07;

    // Byte 3: numOfSequenceParameterSetExt (8-bit)
    const numOfSequenceParameterSetExt = input[offset++];

    // sanity (typical H.264 up to 14-bit)
    if (bit_depth_luma_minus8 > 6 || bit_depth_chroma_minus8 > 6) {
      throw new ProfileExtensionError(
        `bit_depth_*_minus8 exceed typical H.264 limits (luma=${bit_depth_luma_minus8}, chroma=${bit_depth_chroma_minus8}).`,
        { partial, remaining: input.subarray(offset), offset }
      );
    }

    const sequenceParameterSetExt: NALUnit[] = [];
    for (let i = 0; i < numOfSequenceParameterSetExt; i++) {
      const res = parseNalUnitExt(input, offset, partial);
      sequenceParameterSetExt.push(res.nal);
      offset = res.offset;
    }

    highProfileFields = {
      chroma_format,
      bit_depth_luma_minus8,
      bit_depth_chroma_minus8,
      numOfSequenceParameterSetExt,
      sequenceParameterSetExt,
    };
    partial.highProfileFields = highProfileFields;
  }

  // Strict: no trailing bytes
  const remaining = input.subarray(offset);
  if (remaining.length !== 0) {
    throw new TrailingDataError(`Trailing bytes present after end of AVCDecoderConfigurationRecord: ${remaining.length} byte(s).`, {
      partial, remaining, offset,
    });
  }

  const record: AvcDecoderConfigurationRecord = {
    configurationVersion: 1,
    AVCProfileIndication,
    profile_compatibility,
    AVCLevelIndication,
    lengthSizeMinusOne: partial.lengthSizeMinusOne as 0 | 1 | 2 | 3,
    numOfSequenceParameterSets,
    sequenceParameterSets,
    numOfPictureParameterSets,
    pictureParameterSets,
    ...(highProfileFields ? { highProfileFields } : {}),
  };

  return { record, remaining };
}

export function tryParseAvcDecoderConfigurationRecord(input: Uint8Array):
  | { record: AvcDecoderConfigurationRecord; remaining: Uint8Array }
  | undefined {
  try { return parseAvcDecoderConfigurationRecord(input); }
  catch { return undefined; }
}

/* =========================
 * SPS parsing
 * ========================= */

export interface SpsCore {
  profile_idc: number;                     // u(8)
  constraint_set0_flag: 0 | 1;             // u(1)
  constraint_set1_flag: 0 | 1;             // u(1)
  constraint_set2_flag: 0 | 1;             // u(1)
  reserved_zero_5bits: number;             // u(5) MUST be 0
  level_idc: number;                        // u(8)
  seq_parameter_set_id: number;            // ue(v)
  log2_max_frame_num_minus4: number;       // ue(v)
  pic_order_cnt_type: 0 | 1 | 2;           // ue(v)
  log2_max_pic_order_cnt_lsb_minus4?: number; // ue(v) if type==0
  delta_pic_order_always_zero_flag?: 0 | 1;    // u(1) if type==1
  offset_for_non_ref_pic?: number;         // se(v) if type==1
  offset_for_top_to_bottom_field?: number; // se(v) if type==1
  num_ref_frames_in_pic_order_cnt_cycle?: number; // ue(v) if type==1
  offset_for_ref_frame?: number[];         // se(v)[n] if type==1
  num_ref_frames: number;                  // ue(v)
  gaps_in_frame_num_value_allowed_flag: 0 | 1; // u(1)
  pic_width_in_mbs_minus1: number;         // ue(v)
  pic_height_in_map_units_minus1: number;  // ue(v)
  frame_mbs_only_flag: 0 | 1;              // u(1)
  mb_adaptive_frame_field_flag?: 0 | 1;    // u(1) if !frame_mbs_only_flag
  direct_8x8_inference_flag: 0 | 1;        // u(1)
  frame_cropping_flag: 0 | 1;              // u(1)
  frame_crop_left_offset?: number;         // ue(v) if cropping
  frame_crop_right_offset?: number;        // ue(v)
  frame_crop_top_offset?: number;          // ue(v)
  frame_crop_bottom_offset?: number;       // ue(v)
  vui_parameters_present_flag: 0 | 1;      // u(1)
  coded_width?: number;                    // derived
  coded_height?: number;                   // derived
  // Add these optional fields to SpsCore
  chroma_format_idc?: 0 | 1 | 2 | 3;
  separate_colour_plane_flag?: 0 | 1;
  bit_depth_luma_minus8?: number;   // ue(v)
  bit_depth_chroma_minus8?: number; // ue(v)
  qpprime_y_zero_transform_bypass_flag?: 0 | 1;
  seq_scaling_matrix_present_flag?: 0 | 1;
}

export type PartialSps = Partial<SpsCore>;

export class ParseSpsError extends Error {
  readonly partial?: PartialSps;
  readonly remaining?: Uint8Array;
  readonly bitOffset?: number;
  constructor(message: string, opts?: { partial?: PartialSps; remaining?: Uint8Array; bitOffset?: number }) {
    super(message);
    this.name = this.constructor.name;
    this.partial = opts?.partial;
    this.remaining = opts?.remaining;
    this.bitOffset = opts?.bitOffset;
  }
}
export class SpsForbiddenBitError extends ParseSpsError {}
export class SpsNalTypeError extends ParseSpsError {}
export class SpsReservedBitsError extends ParseSpsError {}
export class SpsTruncatedError extends ParseSpsError {}
export class SpsExpGolombError extends ParseSpsError {}
export class SpsRbspTrailingBitsError extends ParseSpsError {}

/** Remove emulation-prevention bytes (0x03) from EBSP to RBSP. */
export function ebspToRbsp(ebsp: Uint8Array): Uint8Array {
  const out: number[] = [];
  let zeroCount = 0;
  for (let i = 0; i < ebsp.length; i++) {
    const b = ebsp[i];
    if (zeroCount === 2 && b === 0x03) {
      zeroCount = 0;
      continue; // skip 0x03
    }
    out.push(b);
    if (b === 0x00) zeroCount++; else zeroCount = 0;
  }
  return new Uint8Array(out);
}

/** RBSP bit reader */
class BitReader {
  private buf: Uint8Array;
  private bitPos = 0;
  constructor(rbsp: Uint8Array) { this.buf = rbsp; }
  bitsLeft(): number { return (this.buf.length << 3) - this.bitPos; }
  getByteOffset(): number { return this.bitPos >>> 3; }
  getBitOffset(): number { return this.bitPos; }
  readBits(n: number): number {
    if (n < 0 || n > 32) throw new Error(`readBits(${n}) invalid`);
    if (this.bitsLeft() < n) throw new SpsTruncatedError(`Not enough bits: need ${n}, have ${this.bitsLeft()}.`);
    let val = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.buf[this.bitPos >>> 3];
      const bit = 7 - (this.bitPos & 7);
      val = (val << 1) | ((byte >>> bit) & 1);
      this.bitPos++;
    }
    return val >>> 0;
  }
  readUE(): number {
    let zeros = 0;
    while (this.bitsLeft() > 0) {
      const bit = this.readBits(1);
      if (bit === 0) { zeros++; continue; }
      // bit==1: end of prefix
      break;
    }
    if (zeros > 31) throw new SpsExpGolombError(`UE prefix too long (${zeros}).`, { bitOffset: this.getBitOffset() });
    if (zeros === 0) return 0;
    if (this.bitsLeft() < zeros) throw new SpsTruncatedError(`Not enough bits for UE suffix (${zeros}).`);
    const suffix = this.readBits(zeros);
    return ((1 << zeros) - 1) + suffix;
  }
  readSE(): number {
    const ue = this.readUE();
    const sign = (ue & 1) ? 1 : -1;
    return sign * ((ue + 1) >>> 1);
  }
}

/* Minimal VUI skipper to land at rbsp_trailing_bits() */
function readUEsafe(br: BitReader): number {
  try { return br.readUE(); }
  catch (e) {
    if (e instanceof ParseSpsError) throw e;
    throw new SpsExpGolombError(`Failed reading UE(v) inside VUI/HRD: ${(e as Error).message}`, { bitOffset: br.getBitOffset() });
  }
}
function parseScalingList(br: BitReader, sizeOfScalingList: number) {
  // H.264 7.3.2.1.1 scaling_list(): we just skip correctly.
  let lastScale = 8;
  let nextScale = 8;
  for (let j = 0; j < sizeOfScalingList; j++) {
    if (nextScale !== 0) {
      const delta_scale = br.readSE();
      nextScale = (lastScale + delta_scale + 256) % 256;
    }
    lastScale = (nextScale === 0) ? lastScale : nextScale;
  }
}
function skipHrdParameters(br: BitReader) {
  const cpb_cnt_minus1 = readUEsafe(br);
  br.readBits(4); // bit_rate_scale
  br.readBits(4); // cpb_size_scale
  for (let i = 0; i <= cpb_cnt_minus1; i++) {
    readUEsafe(br); // bit_rate_value_minus1
    readUEsafe(br); // cpb_size_value_minus1
    br.readBits(1); // cbr_flag
  }
  br.readBits(5); // initial_cpb_removal_delay_length_minus1
  br.readBits(5); // cpb_removal_delay_length_minus1
  br.readBits(5); // dpb_output_delay_length_minus1
  br.readBits(5); // time_offset_length
}
function skipVuiParameters(br: BitReader) {
  if (br.readBits(1)) { // aspect_ratio_info_present_flag
    const aspect_ratio_idc = br.readBits(8);
    if (aspect_ratio_idc === 255) { br.readBits(16); br.readBits(16); }
  }
  if (br.readBits(1)) { br.readBits(1); } // overscan_info_present_flag -> overscan_appropriate_flag
  if (br.readBits(1)) {
    br.readBits(3); // video_format
    br.readBits(1); // video_full_range_flag
    if (br.readBits(1)) { br.readBits(8); br.readBits(8); br.readBits(8); } // colour_description_present_flag
  }
  if (br.readBits(1)) { readUEsafe(br); readUEsafe(br); } // chroma_loc_info_present_flag
  const timing_info_present_flag = br.readBits(1);
  if (timing_info_present_flag) { br.readBits(32); br.readBits(32); br.readBits(1); }
  const nalHrd = br.readBits(1); if (nalHrd) skipHrdParameters(br);
  const vclHrd = br.readBits(1); if (vclHrd) skipHrdParameters(br);
  if (nalHrd || vclHrd) br.readBits(1); // low_delay_hrd_flag
  br.readBits(1); // pic_struct_present_flag
  if (br.readBits(1)) { // bitstream_restriction_flag
    br.readBits(1); // motion_vectors_over_pic_boundaries_flag
    readUEsafe(br); readUEsafe(br); readUEsafe(br); readUEsafe(br);
    readUEsafe(br); readUEsafe(br);
  }
}

/**
 * Parse a SINGLE SPS NAL unit (including 1-byte NAL header).
 * Strict per given structure; validates rbsp_trailing_bits().
 */
 
export function parseSpsNalUnit(spsNal: Uint8Array): SpsCore {
  const partial: PartialSps = {};
  if (spsNal.length < 2) {
    throw new SpsTruncatedError(`SPS NAL too short (${spsNal.length} bytes).`, { partial, remaining: spsNal });
  }

  // NAL header checks
  const forbidden_zero_bit = (spsNal[0] >>> 7) & 0x01;
  const nal_unit_type = spsNal[0] & 0x1F;
  if (forbidden_zero_bit !== 0) {
    throw new SpsForbiddenBitError(`SPS forbidden_zero_bit must be 0 (got ${forbidden_zero_bit}).`, {
      partial, remaining: spsNal.subarray(1),
    });
  }
  if (nal_unit_type !== 7) {
    throw new SpsNalTypeError(`NAL unit is not SPS (expected type 7, got ${nal_unit_type}).`, {
      partial, remaining: spsNal.subarray(1),
    });
  }

  // EBSP -> RBSP, then parse bits
  const rbsp = ebspToRbsp(spsNal.subarray(1));
  const br = new BitReader(rbsp);

  // --- SPS core (up to FRExt gate) ---
  const profile_idc = br.readBits(8); partial.profile_idc = profile_idc;
  const constraint_set0_flag = br.readBits(1) as 0 | 1;
  const constraint_set1_flag = br.readBits(1) as 0 | 1;
  const constraint_set2_flag = br.readBits(1) as 0 | 1;
  const reserved_zero_5bits = br.readBits(5);
  if (reserved_zero_5bits !== 0) {
    throw new SpsReservedBitsError(`reserved_zero_5bits must be 0 (got ${reserved_zero_5bits}).`, {
      partial, remaining: rbsp.subarray(br.getByteOffset()), bitOffset: br.getBitOffset(),
    });
  }
  partial.constraint_set0_flag = constraint_set0_flag;
  partial.constraint_set1_flag = constraint_set1_flag;
  partial.constraint_set2_flag = constraint_set2_flag;
  partial.reserved_zero_5bits = reserved_zero_5bits;

  const level_idc = br.readBits(8); partial.level_idc = level_idc;
  const seq_parameter_set_id = br.readUE(); partial.seq_parameter_set_id = seq_parameter_set_id;

  // --- FRExt block for High and friends ---
  const profilesWithFRExt = new Set([100,110,122,244,44,83,86,118,128,138,139,134]);
  let chroma_format_idc: 0 | 1 | 2 | 3 = 1; // default if not present
  let separate_colour_plane_flag: 0 | 1 = 0;

  if (profilesWithFRExt.has(profile_idc)) {
    chroma_format_idc = br.readUE() as 0 | 1 | 2 | 3;
    partial.chroma_format_idc = chroma_format_idc;

    if (chroma_format_idc === 3) {
      separate_colour_plane_flag = br.readBits(1) as 0 | 1;
      partial.separate_colour_plane_flag = separate_colour_plane_flag;
    }

    partial.bit_depth_luma_minus8 = br.readUE();
    partial.bit_depth_chroma_minus8 = br.readUE();
    partial.qpprime_y_zero_transform_bypass_flag = br.readBits(1) as 0 | 1;

    const seq_scaling_matrix_present_flag = br.readBits(1) as 0 | 1;
    partial.seq_scaling_matrix_present_flag = seq_scaling_matrix_present_flag;

    if (seq_scaling_matrix_present_flag) {
      const scalingListCount = (chroma_format_idc === 3) ? 12 : 8;
      for (let i = 0; i < scalingListCount; i++) {
        const present = br.readBits(1);
        if (present) {
          const size = (i < 6) ? 16 : 64;
          parseScalingList(br, size);
        }
      }
    }
  } else {
    // Assume 4:2:0 if older/Main/Baseline etc (no FRExt fields present)
    partial.chroma_format_idc = chroma_format_idc;
    partial.separate_colour_plane_flag = separate_colour_plane_flag;
  }

  // --- Rest of SPS as before ---
  partial.log2_max_frame_num_minus4 = br.readUE();

  const pic_order_cnt_type = br.readUE();
  if (pic_order_cnt_type > 2) {
    throw new SpsExpGolombError(`pic_order_cnt_type must be 0,1,2 (got ${pic_order_cnt_type}).`, {
      partial, remaining: rbsp.subarray(br.getByteOffset()), bitOffset: br.getBitOffset(),
    });
  }
  partial.pic_order_cnt_type = pic_order_cnt_type as 0 | 1 | 2;

  if (pic_order_cnt_type === 0) {
    partial.log2_max_pic_order_cnt_lsb_minus4 = br.readUE();
  } else if (pic_order_cnt_type === 1) {
    partial.delta_pic_order_always_zero_flag = br.readBits(1) as 0 | 1;
    partial.offset_for_non_ref_pic = br.readSE();
    partial.offset_for_top_to_bottom_field = br.readSE();
    const n = br.readUE();
    partial.num_ref_frames_in_pic_order_cnt_cycle = n;
    const arr: number[] = [];
    for (let i = 0; i < n; i++) arr.push(br.readSE());
    partial.offset_for_ref_frame = arr;
  }

  partial.num_ref_frames = br.readUE();
  partial.gaps_in_frame_num_value_allowed_flag = br.readBits(1) as 0 | 1;

  partial.pic_width_in_mbs_minus1 = br.readUE();
  const pic_height_in_map_units_minus1 = br.readUE(); partial.pic_height_in_map_units_minus1 = pic_height_in_map_units_minus1;

  const frame_mbs_only_flag = br.readBits(1) as 0 | 1; partial.frame_mbs_only_flag = frame_mbs_only_flag;
  if (!frame_mbs_only_flag) {
    partial.mb_adaptive_frame_field_flag = br.readBits(1) as 0 | 1;
  }

  partial.direct_8x8_inference_flag = br.readBits(1) as 0 | 1;

  partial.frame_cropping_flag = br.readBits(1) as 0 | 1;
  let frame_crop_left_offset = 0, frame_crop_right_offset = 0, frame_crop_top_offset = 0, frame_crop_bottom_offset = 0;
  if (partial.frame_cropping_flag) {
    frame_crop_left_offset   = br.readUE();
    frame_crop_right_offset  = br.readUE();
    frame_crop_top_offset    = br.readUE();
    frame_crop_bottom_offset = br.readUE();
    partial.frame_crop_left_offset   = frame_crop_left_offset;
    partial.frame_crop_right_offset  = frame_crop_right_offset;
    partial.frame_crop_top_offset    = frame_crop_top_offset;
    partial.frame_crop_bottom_offset = frame_crop_bottom_offset;
  }

  partial.vui_parameters_present_flag = br.readBits(1) as 0 | 1;
  if (partial.vui_parameters_present_flag) {
    skipVuiParameters(br);
  }

  // ---- rbsp_trailing_bits() ----
  if (br.bitsLeft() <= 0) {
    throw new SpsRbspTrailingBitsError(`Missing rbsp_trailing_bits().`, {
      partial, remaining: new Uint8Array(0), bitOffset: br.getBitOffset(),
    });
  }
  if (br.readBits(1) !== 1) {
    throw new SpsRbspTrailingBitsError(`rbsp_trailing_bits(): stop_one_bit must be 1.`, {
      partial, remaining: new Uint8Array(0), bitOffset: br.getBitOffset(),
    });
  }
  const rem = br.bitsLeft() & 7;
  for (let i = 0; i < rem; i++) {
    if (br.readBits(1) !== 0) {
      throw new SpsRbspTrailingBitsError(`rbsp_trailing_bits(): alignment bit ${i} is not zero.`, {
        partial, remaining: new Uint8Array(0), bitOffset: br.getBitOffset(),
      });
    }
  }
  if (br.bitsLeft() !== 0) {
    throw new SpsRbspTrailingBitsError(`Extra bits present after rbsp_trailing_bits(): ${br.bitsLeft()} bit(s).`, {
      partial, remaining: new Uint8Array(0), bitOffset: br.getBitOffset(),
    });
  }

  // ---- Derived dimensions (use chroma_format_idc for crop multipliers) ----
  const widthInSamples = (partial.pic_width_in_mbs_minus1! + 1) * 16;
  const heightInMapUnits = (pic_height_in_map_units_minus1 + 1);
  const frameHeightInMbs = heightInMapUnits * (2 - frame_mbs_only_flag);
  const heightInSamples = frameHeightInMbs * 16;

  // Crop multipliers (H.264 semantics)
  const cf = chroma_format_idc; // 0: mono, 1: 4:2:0, 2: 4:2:2, 3: 4:4:4
  let cropLeft = frame_crop_left_offset;
  let cropRight = frame_crop_right_offset;
  let cropTop = frame_crop_top_offset;
  let cropBottom = frame_crop_bottom_offset;

  if (separate_colour_plane_flag || cf === 0) {
    // monochrome or separate colour planes: units are luma samples
    cropTop    *= (2 - frame_mbs_only_flag);
    cropBottom *= (2 - frame_mbs_only_flag);
  } else {
    // chroma present on same plane
    if (cf === 1 || cf === 2) { // 4:2:0 or 4:2:2
      cropLeft  *= 2;
      cropRight *= 2;
    }
    if (cf === 1) { // 4:2:0
      cropTop    *= 2;
      cropBottom *= 2;
    }
  }

  partial.coded_width  = widthInSamples  - (cropLeft + cropRight);
  partial.coded_height = heightInSamples - (cropTop + cropBottom);

  return partial as SpsCore;
}

/* =========================
 * Example usage (remove in prod if you want)
 * =========================
 *
 * const avcc = new Uint8Array([
 *   0x01,0x64,0x00,0x29,0xff,0xe1,0x00,0x1e,
 *   0x27,0x64,0x00,0x29,0xac,0x1a,0xd0,0x0f,
 *   0x00,0x44,0xfc,0xb3,0x70,0x10,0x10,0x14,
 *   0x00,0x00,0x03,0x00,0x04,0x00,0x00,0x03,
 *   0x00,0x62,0x3c,0x50,0x8a,0x80,0x01,0x00,
 *   0x05,0x28,0xee,0x09,0x24,0x89,0xfd,0xf8, // PPS length here is 5 in this dump
 *   0xf8,0x00
 * ]);
 *
 * try {
 *   const { record } = parseAvcDecoderConfigurationRecord(avcc);
 *   const sps = parseSpsNalUnit(record.sequenceParameterSets[0].data);
 *   console.log(record, sps);
 * } catch (e) {
 *   // Handle ParseAvcCError or ParseSpsError; both expose .partial and .remaining
 *   console.error(e);
 * }
 */

