import * as readline from 'readline'
import Machine from './Machine'

const red = '\u001b[31;1m'
const blue = '\u001b[34;1m'
const reset = '\u001b[0m'

;(async () => {
  const machine = new Machine()

  const repl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  await machine.start()

  repl.prompt()

  repl.on('line', async (line: string) => {
    // When user enters a line, execute a shell `CodeChunk`
    const result = await machine.call('execute', {
      type: 'CodeChunk',
      programmingLanguage: 'sh',
      text: line
    })

    // Display any errors
    if (result.errors && result.errors.length > 0) {
      process.stderr.write(red)
      for (const error of result.errors) process.stderr.write(error || '')
      process.stderr.write(reset)
    }

    // Display any outputs
    if (result.outputs && result.outputs.length > 0) {
      process.stdout.write(blue)
      for (const output of result.outputs) process.stdout.write(output || '')
      process.stdout.write(reset)
    }

    // Provide a new prompt
    repl.prompt()
  })

})()
