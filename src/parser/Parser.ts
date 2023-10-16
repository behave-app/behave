const asciiDecoder = new TextDecoder("ascii")

export class ParseError extends Error {}
export class NotEnoughDataError extends ParseError {
  constructor(message?: string) {
    super(`Not enough data error: ${message}`);
  }
}

export class NoMatchError extends ParseError {
  constructor(message?: string) {
    super(`No match error: ${message}`);
  }
}

export class Data {
  buffer: ArrayBuffer
  bytePointer: number
  bitPointer: number
  moreDataAvailable: boolean
  constructor(buffer: ArrayBuffer, bytePointer: number, bitPointer: number, moreDataAvailable: boolean) {
    this.buffer = buffer;
    this.bytePointer = bytePointer;
    this.bitPointer = bitPointer;
    this.moreDataAvailable = moreDataAvailable
  }

  copy(skipBytes: number = 0, skipBits: number = 0): Data {
    const newdata = new Data(
      this.buffer, // NOTE: Not copying the buffer
      this.bytePointer,
      this.bitPointer,
      this.moreDataAvailable,
    )
    newdata.consume(skipBytes, skipBits)
    return newdata
  }

  countAvailableBytes(): number {
    const totalBytes = this.buffer.byteLength
    return totalBytes - this.bytePointer - this.bitPointer / 8;
  }

  consume(bytes: number, bits: number = 0): void {
    this.requireEnoughDataAvailable(bytes, bits);
    const newBits = (this.bitPointer + bits) % 8
    const overflow = Math.floor(this.bitPointer + bits / 8)
    const newBytes = this.bytePointer + bytes + overflow
    this.bytePointer = newBytes
    this.bitPointer = newBits
  }

  assertOnByteBoundary(): void {
    if (this.bitPointer !== 0) {
      throw new Error("Not on byte boundary")
    }
  }

  requireEnoughDataAvailable(bytes: number, bits: number = 0): void {
    const required = bytes + bits / 8;
    if (this.countAvailableBytes() < required) {
      if (this.moreDataAvailable) {
        throw new NotEnoughDataError("Need more data");
      } else {
        throw new NoMatchError("Ran out of data");
      }
    }
  }

  parseAscii(length: number): string {
    this.assertOnByteBoundary();
    this.requireEnoughDataAvailable(length)
    const result = asciiDecoder.decode(this.buffer.slice(
      this.bytePointer, this.bytePointer + length));
    this.consume(length)
    return result
  }

  parseUint32(): number {
    this.assertOnByteBoundary();
    this.requireEnoughDataAvailable(4);
    const result = new DataView(this.buffer).getUint32(this.bytePointer)
    this.consume(4)
    return result
  }
}

export class Parsable {
  readonly byteLength: number;
  constructor(byteLength: number) {
    this.byteLength = byteLength;
  }
}

export interface IParsable {
  parse(data: Data): Parsable;
}
