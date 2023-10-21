import {Data, NoMatchError, IParsable} from '../../parser/Parser.js'

export class AssertionError extends Error {
  // assertion Error is a bug in the code, not a bug in the data
  // Not input data should ever be able to trigger an AssertionError
  constructor(message?: string) {
    super(`AssertionError: ${message}`);
  }
}

interface IBox {
  parseBody(byteLength: number, fourcc: string, data: Data): Box;
}

interface IPartialBox extends IBox {
  parseBodyIncremental(byteLength: number, fourcc: string, data: Data): Box;
}

export abstract class Box {
  private static boxtypes: Map<string, IBox | IPartialBox> = new Map();

  constructor(
    public readonly byteLength: number,
    public readonly fourcc: string,
  ) {}

  static addBoxType(fourcc: string, boxtype: IBox) {
    if (Box.boxtypes.has(fourcc)) {
      throw new TypeError(`Box ${fourcc} already added`)
    }
    Box.boxtypes.set(fourcc, boxtype)
  }

  static parseLengthAndFourCC(data: Data): [number, string] {
    data.assertOnByteBoundary()
    let byteLength = data.parseUint32()
    let fourcc = data.parseAscii(4)
    if (byteLength == 1) {
      const bigByteLength = data.parseBigUint64()
      if (bigByteLength > Number.MAX_SAFE_INTEGER) {
        throw new NoMatchError("Size of box is too large for JavaScript")
      }
      byteLength = Number(bigByteLength)
    }
    if (fourcc == "uuid") {
      fourcc = data.parseBytes(16).map(b => (b | 0x100).toString(16).slice(1)).join("")
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5")
    }
    return [byteLength, fourcc]
  }

  static parse(data: Data): [Box, number] {
    data.assertOnByteBoundary()
    const [byteLength, fourcc] = this.parseLengthAndFourCC(data)
    const boxtype = Box.boxtypes.get(fourcc) || GenericBox

    if ("parseBodyIncremental" in boxtype) {
      const endOfBoxPointer = data.bytePointer + byteLength - 8
      const box = boxtype.parseBody(byteLength, fourcc, data)
      return [box, endOfBoxPointer - data.bytePointer]
    }
    const boxdata = data.slice(byteLength - 8)
    data.consume(byteLength - 8)
    const box = boxtype.parseBody(byteLength, fourcc, boxdata)
    if (boxdata.countAvailableBytes()) {
      throw new NoMatchError(
        `box ${fourcc}: ${boxdata.countAvailableBytes()} bytes left`)
    }
    return [box, 0]
  }

  toString(): string {
    return `${this.constructor.name}: ${this.fourcc} (${this.byteLength})`
  }
}

class GenericBox extends Box {
  constructor(byteLength: number, fourcc: string) {
    super(byteLength, fourcc)
  }

  static parseBody(byteLength: number, fourcc: string, data: Data): Box {
    data.assertOnByteBoundary()
    data.consume(byteLength - 8)
    return new GenericBox(byteLength, fourcc);

  }
}



export class ContainerBox extends Box {
  static get FOURCC(): string {
    throw new Error("Abstract getter")
  }
  public readonly subboxes: Box[]

  constructor(
    byteLength: number,
    fourcc: string,
  ) {
    super(byteLength, fourcc)
    this.subboxes = []
  }

  static parseBody(byteLength: number, fourcc: string, data: Data): Box {
    return new this(byteLength, fourcc)
  }

  static parseBodyIncremental(data: Data):  {
    const box = Box.parse(data)

  }

    if (fourcc != this.FOURCC) {
      throw new AssertionError(`Wrong fourcc: ${fourcc} != ${this.FOURCC}`);
    }
    let endOfBoxPointer = data.bytePointer + byteLength - 8;
    const subboxes: Box[] = [];
    while (data.bytePointer < endOfBoxPointer) {
      subboxes.push(Box.parse(data))
    }
    return new this(
      byteLength,
      fourcc,
      subboxes,
    )
  }

  toString(): string {
      return super.toString() + ` {${this.subboxes.map(box => box.toString()).join("; ")}}`
  }
}
