import fs from 'fs'
import path from 'path'

/**
 * The contents of `package.json` available at runtime.
 *
 * Used for things like recording the current version in logging
 * and stats.
 *
 * Attempting to do this with `import pkg from '../package.json`
 * causes an obscure bug in `npm pack` due to the resulting
 * nested `package.json` in `dist`.
 */
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
)
export default pkg
