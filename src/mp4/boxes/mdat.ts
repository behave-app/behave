import {Box, AssertionError} from './base.js'
import {Data, NoMatchError} from '../../parser/Parser.js'

export class MDATBox extends Box {
  static parseBody(data: Data): Box {
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
      byteLength,
      fourcc,
      major_brand,
      minor_version,
      compatible_brands
    )
  }

  toString(): string {
      return super.toString() + ` major_brand: ${this.major_brand}, minor_version: ${this.minor_version}, compatible_brands: ${this.compatible_brands.join(",")}`;
  }
}


