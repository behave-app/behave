import {ContainerBox, AssertionError} from './base.js'
import {Data, NoMatchError} from '../../parser/Parser.js'

export class MOOVBox extends ContainerBox {
  static get FOURCC(): string {
    return "moov"
  }
}
