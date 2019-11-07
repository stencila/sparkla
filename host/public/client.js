/* eslint-disable */

// A little script for testing multiple clients
// connected to a session

const { WebSocketClient } = executa
const { replaceHandlers } = logga

const session = new URLSearchParams(window.location.search).get('session')
const jwt = new URLSearchParams(window.location.search).get('token')

const client = new WebSocketClient({
  host: window.location.hostname,
  port: window.location.port,
  jwt
})

// Attach the session to the code chunk
document.querySelector('stencila-code-chunk').executeHandler = codeChunk => {
  return client.execute(codeChunk, { type: 'SoftwareSession', id: session })
}

// Instead of notifications going to console, create
// notification elements.
replaceHandlers(logData => {
  const { level, message } = logData
  addNotification(level, message)
})
