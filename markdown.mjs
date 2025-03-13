import markdownIt from "markdown-it"
import markdownItAttrs from 'markdown-it-attrs'
import {readFileSync} from "fs"
import {argv, exit} from "process"
const md = markdownIt({html: true})
md.use(markdownItAttrs)

if (argv.length !== 6) {
  console.error(`Run as "${argv[0]} ${argv[1]} file.md basedir '{"version": "someVersion"}' toc`)
  exit(1)
}
const [_node, _md, markdownFile, basedir, versionJSON, toc] = argv
const basedirWithSlash = basedir + (basedir.endsWith("/") ? "" : "/")
if (!markdownFile.startsWith(basedirWithSlash)) {
  console.error("Make sure that markdownFile is under basedir")
  exit(1)
}

const header = readFileSync(`${basedir}/header._html`, {encoding: "utf8"})
const footer = readFileSync(`${basedir}/footer._html`, {encoding: "utf8"})
const src = readFileSync(markdownFile, {encoding: "utf8"})

let res = header + getToc(toc) + `<div class="mainbody">` +  md.render(src) + `</div>`  + footer;
const subDirs = markdownFile.split("/").length - basedirWithSlash.split("/").length
const baseDirCorrection = subDirs === 0 ? "." : new Array(subDirs).fill("..").join("/")
res = res.replaceAll("$(BASEDIR)", baseDirCorrection)

const version = JSON.parse(versionJSON)["version"]
res = res.replaceAll("$(BEHAVE_VERSION)", version)

console.log(res);

function escapeHTML(unsafe) {
  return unsafe.replace(
    /[\u0000-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u00FF]/g,
    c => '&#' + ('000' + c.charCodeAt(0)).slice(-4) + ';'
  )
}


function getToc(toc) {

  const exceptions = {
    app: {
      _header: "BEHAVE apps",
      _class: "toc_app",
      _match_all: true,
      "infer.html": "BEHAVE infer",
      "convert.html": "BEHAVE convert",
      "viewer.html": "BEHAVE UI",
      "index.html": false,  // do not show
    },
    guides: {
      _header: "Guides",
    },
    contact: {
      "bugs.html": "Report a bug",
    },
    help: {
      _header: "FAQs",
      _label_generator: s => {
        let label = s.replace(/\.[^.]*$/, "")
        label = label[0].toLocaleUpperCase() + label.slice(1)
        if (label.endsWith("-faq")) {
          label = label.slice(0, -4) + " FAQ"
        }
        return label
      },
    },
  }

  const addToStruct = (struct, item_to_add) => {
    const key = item_to_add[0]
    const result =  {
      ...struct,
      [key]: item_to_add.length === 1 ? true : addToStruct(struct[key] ?? {}, item_to_add.slice(1))
    }
    return result
  }

  const tocStruct = toc.split(" ").sort().reduce(
    (prev, cur) => addToStruct(prev, cur.split('/')), {})

  const toHTML = (struct) => {
    return `<ul class="toc_menu">` + Object.entries(struct).map(([dirname, files]) => {
      if (files === true) {
        return ""
      }
      const exceptions_for_dir = exceptions[dirname] ?? {}
      const header = exceptions_for_dir._header ?? dirname[0].toLocaleUpperCase() + dirname.slice(1)
      const classname = "toc_item " + exceptions_for_dir._class ?? ""
      const labelgenerator = exceptions_for_dir._label_generator ?? (s => {
        let label = s.replace(/\.[^.]*$/, "").replace("_", " ")
        label = label[0].toLocaleUpperCase() + label.slice(1)
        return label;
      })
      const match_all = exceptions_for_dir._match_all ?? false
      return `<li><h4>${escapeHTML(header)}</h4><ul class=${escapeHTML(classname)}>`
        + Object.entries(files).map(
          ([filename, isfile]) => {
            if (!isfile) {
              throw new Error(`Should be file ${dirname}/${filename}`)
            }
            if (match_all && !(filename in exceptions_for_dir)) {
              throw new Error(`Should have line for ${dirname}/${filename}`)
            }
            const label = exceptions_for_dir[filename] ?? labelgenerator(filename)
            if (label === false) {
              return ""
            }
            return `<li><a href="$(BASEDIR)/${escapeHTML(dirname)}/${escapeHTML(filename)}">${escapeHTML(label)}</a></li>`
      }).join("\n") + `</ul></li>`
    }).join("\n") + `</ul>`
  }

  const tocHTML = toHTML(tocStruct.public, "$(BASEDIR)")
  return tocHTML
}
