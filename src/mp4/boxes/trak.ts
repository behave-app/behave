import {ContainerBox, AssertionError} from './base.js'
import {Data, NoMatchError} from '../../parser/Parser.js'

export class TRAKBox extends ContainerBox {
  static get FOURCC(): string {
    return "trak"
  }
}
