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
  constructor(
    public view: DataView,
    public bytePointer: number,
    public bitPointer: number,
    public moreDataAvailable: boolean,
  ) {}

  slice(byteLength: number): Data {
    this.requireEnoughDataAvailable(byteLength)
    this.assertOnByteBoundary()
    return new Data(
      new DataView(
        this.view.buffer,
        this.view.byteOffset + this.bytePointer,
        byteLength),
      0, 0, false)
  }

  countAvailableBytes(): number {
    const totalBytes = this.view.byteLength
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
    const result = asciiDecoder.decode(this.view.buffer.slice(
      this.view.byteOffset + this.bytePointer,
      this.view.byteOffset + this.bytePointer + length));
    this.consume(length)
    return result
  }

  parseBytes(count: number): readonly number[] {
    this.assertOnByteBoundary();
    this.requireEnoughDataAvailable(count);
    const result = Array(count).map((_, index) => this.view.getUint8(this.bytePointer + index))
    this.consume(count)
    return result
  }

  parseUint8(): number {
    this.assertOnByteBoundary();
    this.requireEnoughDataAvailable(1);
    const result = this.view.getUint8(this.bytePointer)
    this.consume(1)
    return result
  }

  parseUint16(): number {
    this.assertOnByteBoundary();
    this.requireEnoughDataAvailable(2);
    const result = this.view.getUint16(this.bytePointer)
    this.consume(2)
    return result
  }

  parseUint24(): number {
    this.assertOnByteBoundary();
    this.requireEnoughDataAvailable(3);
    const result = this.view.getUint16(this.bytePointer) << 8 | this.view.getUint8(this.bytePointer + 2)
    this.consume(3)
    return result
  }

  parseUint32(): number {
    this.assertOnByteBoundary();
    this.requireEnoughDataAvailable(4);
    const result = this.view.getUint32(this.bytePointer)
    this.consume(4)
    return result
  }

  parseBigUint64(): bigint {
    this.assertOnByteBoundary();
    this.requireEnoughDataAvailable(8);
    const result = this.view.getBigUint64(this.bytePointer)
    this.consume(8)
    return result
  }
}

export interface IParsable {
  parse(data: Data): any;
}
