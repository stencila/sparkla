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
const props = clas.children

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
const md = `
| Name    | Description       | Type        | Default |
| ------- | ----------------- | ----------- | ------- |
${props
  .map(prop => {
    const { name, defaultValue } = prop
    const comment = prop.comment.shortText.trim().replace(/\s+/gm, ' ')
    const type = prop.type.toString().replace('|', ', ')
    return `|${name.padEnd(20)}|${comment.padEnd(
      100
    )}|${type.padEnd(20)}|${defaultValue.padEnd(15)}|`
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
