import {Data, NoMatchError, Parsable, IParsable} from '../../parser/Parser.js'

export class AssertionError extends Error {
  // assertion Error is a bug in the code, not a bug in the data
  // Not input data should ever be able to trigger an AssertionError
  constructor(message?: string) {
    super(`AssertionError: ${message}`);
  }
}

interface IBox extends IParsable {
  parse(data: Data): Box;
}


export abstract class Box extends Parsable {
  private static boxtypes: Map<string, IBox> = new Map();
  readonly fourcc: string;

  constructor(byteLength: number, fourcc: string) {
    super(byteLength)
    this.fourcc = fourcc;
  }

  static addBoxType(fourcc: string, boxtype: IBox) {
    if (Box.boxtypes.has(fourcc)) {
      throw new TypeError(`Box ${fourcc} already added`)
    }
    Box.boxtypes.set(fourcc, boxtype)
  }

  static parse(data: Data): Box {
    data.assertOnByteBoundary()
    const boxfourcc = data.copy(4).parseAscii(4)
    const boxtype = Box.boxtypes.get(boxfourcc) || GenericBox
    return boxtype.parse(data)
  }

  toString(): string {
    return `${this.constructor.name}: ${this.fourcc} (${this.byteLength})`
  }
}

class FTYPBox extends Box {
  readonly major_brand: string;
  readonly minor_version: number;
  readonly compatible_brands: ReadonlyArray<string>;

  constructor(fourcc: string, byteLength: number, major_brand: string, minor_version: number, compatible_brands: ReadonlyArray<string>) {
    super(byteLength, fourcc)
    this.major_brand = major_brand;
    this.minor_version = minor_version;
    this.compatible_brands = compatible_brands;
  }

  static parse(data: Data): Box {
    data.assertOnByteBoundary()

    const byteLength = data.parseUint32();
    const expectedEndPointer = data.bytePointer + byteLength - 4
    const fourcc = data.parseAscii(4)
    if (fourcc != "ftyp") {
      throw new AssertionError("Wrong fourcc");
    }
    const major_brand = data.parseAscii(4)
    const minor_version = data.parseUint32()
    const compatible_brands: string[] = []
    for (let pointer = 16; pointer < byteLength; pointer+=4) {
      compatible_brands.push(data.parseAscii(4))
    }
    if (data.bytePointer !== expectedEndPointer) {
      throw new NoMatchError("Not the whole object cleanly parsed");
    }
    return new FTYPBox(
      fourcc,
      byteLength,
      major_brand,
      minor_version,
      compatible_brands
    )
  }

  toString(): string {
      return super.toString() + ` major_brand: ${this.major_brand}, minor_version: ${this.minor_version}, compatible_brands: ${this.compatible_brands.join(",")}`;
  }
}

class MOOVBox extends Box {
  readonly subboxes: ReadonlyArray<Box>;

  constructor(fourcc: string, byteLength: number, subboxes: ReadonlyArray<Box>) {
    super(byteLength, fourcc)
    this.subboxes = subboxes;
  }

  static parse(data: Data): Box {
    data.assertOnByteBoundary()

    const byteLength = data.parseUint32();
    const expectedEndPointer = data.bytePointer + byteLength - 4
    const fourcc = data.parseAscii(4)
    if (fourcc != "moov") {
      throw new AssertionError("Wrong fourcc");
    }
    let pointer = 8
    const subboxes: Box[] = [];
    while (pointer < byteLength) {
      const subbox = Box.parse(data)
      pointer += subbox.byteLength
      subboxes.push(subbox)
    }
    if (data.bytePointer !== expectedEndPointer) {
      throw new NoMatchError("Not the whole object cleanly parsed");
    }
    return new MOOVBox(
      fourcc,
      byteLength,
      subboxes,
    )
  }

  toString(): string {
      return super.toString() + ` (${this.subboxes.map(box => box.toString()).join("; ")})`
  }
}

Box.addBoxType("ftyp", FTYPBox);
Box.addBoxType("moov", MOOVBox);

class GenericBox extends Box {
  constructor(byteLength: number, fourcc: string) {
    super(byteLength, fourcc)
  }

  static parse(data: Data): Box {
    data.assertOnByteBoundary()
    const byteLength = data.parseUint32();
    const boxfourcc = data.parseAscii(4)
    data.consume(byteLength - 8)
    return new GenericBox(byteLength, boxfourcc);

  }
}
