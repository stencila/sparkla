// @ts-nocheck because the typedoc typings are painful to work with :/

/**
 * Script to generate docs for configuration options
 */

import * as typedoc from '@gerrit0/typedoc'
import fs from 'fs'

const app = new typedoc.Application({
  module: 'commonjs',
  target: 'es2017'
})

const file = app.convert(['./host/Config.ts'])
const clas = Object.values(file.reflections).filter(
  clas => clas.kindString === 'Class'
)[0]
const props = clas.children.sort((a, b) => a.sources[0].line > b.sources[0].line ? 1 : -1)

// Generate a sample JSON config file with comments
const json = `{
${props
  .map(prop => {
    const {
      comment: { shortText },
      name,
      defaultValue
    } = prop
    const comment = shortText.trim().replace('\n', '\n  // ')
    return `  // ${comment}\n  "${name}": ${defaultValue}`
  })
  .join(',\n\n')}
}`
fs.writeFileSync('.sparklarc', json)

// Generate Markdown table and insert into README
const widths = [15, 120, 30, 20]
const name = (name, col) => name.padEnd(widths[col])
const dashes = (col) => '-'.repeat(widths[col])
const md = `
| ${name('Name', 0)} | ${name('Description', 1)} | ${name('Type', 2)} | ${name('Default', 3)} |
| ${dashes(0)} | ${dashes(1)} | ${dashes(2)} | ${dashes(3)} |
${props
  .map(prop => {
    const name = prop.name.padEnd(widths[0])
    const comment = prop.comment.shortText.trim().replace(/\s+/gm, ' ').padEnd(widths[1])
    const type = prop.type.toString().replace(/\s*\|\s*/, ', ').padEnd(widths[2])
    const defaultValue = prop.defaultValue.padEnd(widths[3])
    return `| ${name} | ${comment} | ${type} | ${defaultValue} |`
  })
  .join('\n')}
`
const readme = fs
  .readFileSync('README.md', 'utf8')
  .replace(
    /<!-- OPTIONS-BEGIN -->[\s\S]*?<!-- OPTIONS-END -->/gm,
    `<!-- OPTIONS-BEGIN -->\n${md}\n<!-- OPTIONS-END -->`
  )
fs.writeFileSync('README.md', readme)
