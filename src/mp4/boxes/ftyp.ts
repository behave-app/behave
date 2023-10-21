import {Box, AssertionError} from './base.js'
import {Data, NoMatchError} from '../../parser/Parser.js'

export class FTYPBox extends Box {
  readonly major_brand: string;
  readonly minor_version: number;
  readonly compatible_brands: ReadonlyArray<string>;

  constructor(byteLength: number, fourcc: string, major_brand: string, minor_version: number, compatible_brands: ReadonlyArray<string>) {
    super(byteLength, fourcc)
    this.major_brand = major_brand;
    this.minor_version = minor_version;
    this.compatible_brands = compatible_brands;
  }

  static parseBody(byteLength: number, fourcc: string, data: Data): Box {
    data.assertOnByteBoundary()

    if (fourcc != "ftyp") {
      throw new AssertionError("Wrong fourcc");
    }
    const major_brand = data.parseAscii(4)
    const minor_version = data.parseUint32()
    const compatible_brands: string[] = []
    for (let pointer = 16; pointer < byteLength; pointer+=4) {
      compatible_brands.push(data.parseAscii(4))
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


