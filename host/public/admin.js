/* eslint-disable */

const { WebSocketClient } = executa

/**
 * A client to connect to the `Manager`.
 *
 * Using a `WebSocketClient` so that we can get
 * server-sent notifications in this app.
 *
 * Extending that class to have custom handling of
 * notifications.
 *
 * Not using a `BaseExecutor` since we just want to send
 * requests to the `Manager` and don't need to delegate
 * to in-browser executors (e.g. JS or WASM).
 */
class ManagerClient extends WebSocketClient {

  /**
   * @override
   *
   * Receive a notification from the `ManagerServer`.
   */
  notified (level, message, node) {
    addNotification(level, message, node)
  }

}

const token = new URLSearchParams(window.location.search).get('token')

const executor = new ManagerClient({
  host: window.location.hostname,
  port: window.location.port,
  jwt: token
})

/**
 * Create a element from HTML
 */
function elem(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.firstElementChild
}

/**
 * List all sessions with details and buttons to
 * end and execute code in them
 */
async function listSessions() {
  const response = await fetch('/admin', {
    headers: {
      Accept: 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`
    }
  })
  const sessions = await response.json()

  let list = document.querySelector('#sessions .list')
  if (!list) {
    const sessions = elem(
      `<div id="sessions">
        <h3>Current sessions</h3>
        <stencila-action-menu>
          <stencila-button class="refresh" size="xsmall" icon="refresh-ccw" icon-only></stencila-button>
        </stencila-action-menu>
        <div class="list"></div>
      </div>`
    )
    sessions.querySelector('.refresh').onclick = () => listSessions()
    list = sessions.querySelector('#sessions .list')
    document.body.appendChild(sessions)
  } else {
    while (list.firstChild) list.removeChild(list.firstChild)
  }

  for (const id in sessions) {
    const sessionInfo = sessions[id]
    const { node } = sessionInfo
    const { name, status } = node
    const item = elem(
      `<div class="session" id="${id}">
        <stencila-action-menu>
        <stencila-button class="select" size="xsmall" icon="circle">Select</stencila-button>
        <stencila-button class="client" size="xsmall" icon="terminal">Client</stencila-button>
        <stencila-button class="end" size="xsmall" icon="x-square">End</stencila-button>
        </stencila-action-menu>
        ${name} <code>${status}</code>
      </div>`
    )

    item.querySelector('.select').onclick = () => selectSession(sessionInfo)
    item.querySelector('.client').onclick = () => window.open(`/public/client.html?session=${id}&token=${token}`, '_blank')
    item.querySelector('.end').onclick = () => endSession(node)

    list.appendChild(item)
  }
}

/**
 * Start by listing sessions
 */
listSessions()
setInterval(listSessions, 15 * 1000)

/**
 * Default session to start (can be edited by admin user)
 */
const defaultSession = {
  type: 'SoftwareSession',
  clientsRequest: 10,
  durationRequest: 43200,
  timeoutRequest: 3600,
  cpuRequest: 1,
  memoryRequest: 1,
  networkTransferRequest: 1,
  environment: {
    name: 'stencila/sparkla-ubuntu-midi'
  }
}

/**
 * Begin a session
 *
 * @param session A `SoftwareSession` node with details of the
 *                session to start
 */
async function beginSession(session) {
  session = await executor.begin(session)
  console.log('Began', session)
  listSessions()
}

/**
 * Add a section for creating and beginning
 * a `SoftwareSession` node.
 */
const beginElem = elem(`
    <div id="begin">
      <h3>New session</h3>
      <stencila-action-menu>
        <stencila-button class="begin" size="xsmall" icon="play">Begin</stencila-button>
      </stencila-action-menu>
      <textarea rows="10" cols="200" spellcheck="false">${JSON.stringify(
        defaultSession,
        null,
        '  '
      )}</textarea>
    </div>
`)
beginElem.querySelector('.begin').onclick = () =>
  beginSession(JSON.parse(beginElem.querySelector('textarea').value))
document.body.appendChild(beginElem)

/**
 * End a session
 *
 * @param id The id of the session to end.
 */
async function endSession(sessionNode) {
  sessionNode = await executor.end(sessionNode)
  console.log('Ended', sessionNode)
  listSessions()
}

/**
 * Section for details on a selected session
 */
const selectedElem = elem(`
  <div id="selected"></div>
`)
document.body.appendChild(selectedElem)

/**
 * Select a session to display in detail
 */
function selectSession(sessionInfo) {
  const { node: sessionNode} = sessionInfo
  const { name } = sessionNode
  selectedElem.innerHTML = `
      <h3>Selected session</h3>
      <details>
        <summary>${name}</summary>
        <pre><code>${JSON.stringify(sessionInfo, null, '  ')}</code></pre>
      </details>
      <stencila-code-chunk
        itemtype="stencila:CodeChunk"
        data-collapsed="false"
        data-programmingLanguage="python"
      >
        <pre slot="text"><code></code></pre>
      </stencila-code-chunk>
    </div>`
  // Attach the session to the code chunk component
  selectedElem.querySelector('stencila-code-chunk').executeHandler = codeChunk => {
    return executor.execute(codeChunk, sessionNode)
  }
}
