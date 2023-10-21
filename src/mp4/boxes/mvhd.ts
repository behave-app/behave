import {Box, AssertionError} from './base.js'
import {Data, NoMatchError} from '../../parser/Parser.js'

const BASEDATE = new Date("1904-01-01T00:00:00.000Z")

function dateFromTimestamp(timestamp: number): Date {
  return new Date(BASEDATE.valueOf() + timestamp * 1000)
}

export class MVHDBox extends Box {
  constructor (
    byteLength: number,
    fourcc: string,
    public readonly flags: number,
    public readonly version: number,
    public readonly creationTime: Date,
    public readonly modificationTime: Date,
    public readonly timescale: number,
    public readonly duration: number,
    public readonly rate: number,
    public readonly volume: number,
    public readonly nextTrackId: number,
  ) {
    super(byteLength, fourcc);
  }

  static parseBody(byteLength: number, fourcc: string, data: Data): Box {
    data.assertOnByteBoundary()

    console.log("start", data.bytePointer)
    if (fourcc != "mvhd") {
      throw new AssertionError("Wrong fourcc");
    }
    const version = data.parseUint8()
    const flags = data.parseUint24()
    const creationTime = dateFromTimestamp(version == 1 ? Number(data.parseBigUint64()) : data.parseUint32())
    const modificationTime = dateFromTimestamp(version == 1 ? Number(data.parseBigUint64()) : data.parseUint32())
    const timescale = data.parseUint32()
    const duration = version == 1 ? Number(data.parseBigUint64()) : data.parseUint32()
    console.log("rate", data.bytePointer)
    const rate = data.parseUint32() / 0x10000
    const volume = data.parseUint16() >> 8;
    const padding = data.parseBytes(10)
    console.log("matrix", data.bytePointer)
    const transformationMatrix = [...Array(9)].map(_ => data.parseUint32())
    const predefined = [...Array(6)].map(_ => data.parseUint32())
    console.log("nextTrackId", data.bytePointer)
    const nextTrackId = data.parseUint32()
    console.log(version, creationTime, modificationTime)
    return new MVHDBox(
      byteLength,
      fourcc,
      flags,
      version,
      creationTime,
      modificationTime,
      timescale,
      duration,
      rate,
      volume,
      nextTrackId,
    )
  }

  toString(): string {
      return super.toString()
        + ` {created: ${this.creationTime.toISOString()}`
        + ` modified: ${this.creationTime.toISOString()}`
        + ` duration: ${this.duration} / ${this.timescale} = ${(this.duration / this.timescale).toFixed(1)}`
        + ` rate: ${this.rate.toFixed(1)}`
        + ` volume: ${this.volume.toFixed(1)}`
        + ` nextTrackId: ${this.nextTrackId}}`
  }
}
