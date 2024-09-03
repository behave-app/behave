const TAG_PREFIX = "refs/tags/"
const TAG_MATCH = /^refs\/tags\/v\d/
import {exec} from "child_process"
exec("git log  --date='format-local:%Y-%m-%dT%H:%M UTC' '--pretty=format:%H %ad %d' --decorate=full", {env: {TZ: "UTC0"}, HOME: ""}, 
  (error, stdout, stderr) => {
    if (error) {
      throw error;
      }
    const lines = stdout.split("\n").filter(l => l.length).reverse()
    const {tag, count, dt, sha} = lines.reduce(({tag, count}, line) => {
      const [sha, dt, ...rest] = line.split(" ")
      const tags = rest.filter(r => TAG_MATCH.exec(r)).map(
        r => r.slice(TAG_PREFIX.length, -1))
      if (tags.length === 0) {
        return {tag, count: count + 1, dt, sha}
      } else {
        return {tag: tags[0], count: 0, dt, sha}
      }
    }, {tag: "initial", count: 0, dt: "", sha: ""})
    exec("git status --porcelain=v1", {env: {HOME: ""}}, (error, stdout) => {
      if (error) {
        throw error;
      }
      const local_changes = stdout.split("\n").filter(l => l.length).length

      console.log(JSON.stringify({version: [
        `${tag}`,
        count ? `-dev+${count} (${sha.slice(0, 7)}) `: " ",
        local_changes ? `changes: ${local_changes} `: "",
        `(${dt.replace("T", " ")} UTC)`
      ].join("")}))
    })
  })
