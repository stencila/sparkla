const { spawn, exec } = require('child_process')
const fs = require('fs')
const lps = require('length-prefixed-stream')
const net = require('net')
const util = require('util')

const log = fs.createWriteStream('/tmp/execute-server.txt')

const asyncExec = util.promisify(exec)

/**
 * Execute a `CodeChunk` or `CodeExpression` that
 * has `programmingLanguage` `sh` or `bash`.
 * 
 * @param {CodeChunk|CodeExpression} code 
 */
async function executeSh(code) {
  const { text } = code
  try {
    const { stdout, stderr } = await asyncExec(text)
    return {
      ...code,
      outputs: stdout.length > 0 ? [stdout] : undefined,
      errors: stderr.length > 0 ? [stderr] : undefined
    }
  } catch (error) {
    return {
      ...code,
      errors: [error.message]
    }
  }
}

if (process.argv[2] === '-t') {
  var server = net.createServer(async function(socket) {
    await main(socket, socket)
  })
  server.listen(process.argv[3], '0.0.0.0')
} else {
  let vsock  = spawn('/usr/bin/vsock-server', ['7300'])
  vsock.stderr.on('data', error => {
    log.write(error + '\n')
  })

  vsock.on('error', error => {
    log.write(error + '\n')
  })

  vsock.on('exit', (code, signal) => {
    if (signal !== null) log.write(`exited:${signal}\n`)
    else if (code !== 0) log.write(`exited:${code}\n`)
    else log.write(`exited\n`)
  })
  main(vsock.stdout, vsock.stdin)
}

function main(inStream, outStream) {
  try {
    const decode = lps.decode()
    inStream.pipe(decode)

    const encode = lps.encode()
    encode.pipe(outStream)

    decode.on('data', async json => {
      const request = JSON.parse(json)
      const { id, method, params } = request

      let error = null
      if (params === undefined || params.length !== 1) {
        error = 'params was not an array of length 1'      
      } else {
        const node = params[0]
        if (node.programmingLanguage === 'sh') {
          result = await executeSh(node)
        }
      }

      const response = {
        jsonrpc: '2.0',
        id, 
        result,
        error
      }
      encode.write(JSON.stringify(response))
    })
  } catch (err) {
    log.write(err + '\n')
  }
}
