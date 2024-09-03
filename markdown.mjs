import markdownIt from "markdown-it"
import markdownItAttrs from 'markdown-it-attrs'
import {readFileSync} from "fs"
import {argv, exit} from "process"
const md = markdownIt({html: true})
md.use(markdownItAttrs)

if (argv.length !== 5) {
  console.error(`Run as "${argv[0]} ${argv[1]} file.md basedir '{"version": "someVersion"}' `)
  exit(1)
}
const [_node, _md, markdownFile, basedir, versionJSON] = argv
const basedirWithSlash = basedir + (basedir.endsWith("/") ? "" : "/")
if (!markdownFile.startsWith(basedirWithSlash)) {
  console.error("Make sure that markdownFile is under basedir")
  exit(1)
}

const header = readFileSync(`${basedir}/header._html`, {encoding: "utf8"})
const footer = readFileSync(`${basedir}/footer._html`, {encoding: "utf8"})
const src = readFileSync(markdownFile, {encoding: "utf8"})

let res = header + md.render(src) + footer;
const subDirs = markdownFile.split("/").length - basedirWithSlash.split("/").length
const baseDirCorrection = subDirs === 0 ? "." : new Array(subDirs).fill("..").join("/")
res = res.replaceAll("$(BASEDIR)", baseDirCorrection)

const version = JSON.parse(versionJSON)["version"]
res = res.replaceAll("$(BEHAVE_VERSION)", version)

console.log(res);
