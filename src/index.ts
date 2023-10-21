import {Data} from './parser/Parser.js'
import {Box} from './mp4/boxes/Box.js'
console.log("hello");
const mp4buffer = await (await fetch("video.mp4")).arrayBuffer();

let data = new Data(new DataView(mp4buffer), 0, 0, false);

let i = 0;
while (i < 10) {
  i++;
  const box = Box.parse(data) 
  console.log(box.toString())
}
