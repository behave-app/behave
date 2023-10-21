import {Data, NoMatchError, Parsable, IParsable} from '../../parser/Parser.js'
import {Box, AssertionError} from './base.js'
import {FTYPBox} from './ftyp.js'
import {MOOVBox} from './moov.js'
import {MVHDBox} from './mvhd.js'
import {TRAKBox} from './trak.js'


Box.addBoxType("ftyp", FTYPBox);
Box.addBoxType("moov", MOOVBox);
Box.addBoxType("mvhd", MVHDBox);
Box.addBoxType("trak", TRAKBox);

export {Box, AssertionError, FTYPBox, MOOVBox}
