/* eslint-disable */

const { WebSocketClient } = executa
const { getLogger, replaceHandlers } = logga

const log = getLogger('sparkla:browser:admin')

// Instead of notifications going to console, create
// notification elements.
replaceHandlers(logData => {
  const { level, message } = logData
  addNotification(level, message)
})

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
  notified(level, message, node) {
    addNotification(level, message, node)
  }
}

const jwt = new URLSearchParams(window.location.search).get('jwt')

const executor = new ManagerClient({
  host: window.location.hostname,
  port: window.location.port,
  jwt
})

async function update() {
  const response = await fetch('/admin', {
    headers: {
      Accept: 'application/json; charset=utf-8',
      Authorization: `Bearer ${jwt}`
    }
  })
  const { manifest, sessions, peers } = await response.json()
  showInstance(manifest)
  listSessions(sessions)
  listPeers(peers)
}

/**
 * Show details of teh instance
 */
const instance = elem(
  `<div id="instance">
    <h3>Instance</h3>
    <stencila-action-menu>
      <stencila-button class="refresh" size="xsmall" icon="refresh-ccw" icon-only></stencila-button>
    </stencila-action-menu>
    <p class="id"></p>
    <details>
      <summary>Manifest</summary>
      <pre><code class="json"></code></pre>
    </details>
  </div>`
)
document.body.appendChild(instance)
instance.querySelector('.refresh').onclick = () => update()
function showInstance(manifest) {
  instance.querySelector('.id').innerHTML = manifest.id
  instance.querySelector('.json').innerHTML = JSON.stringify(
    manifest,
    null,
    '  '
  )
}

/**
 * List all sessions with details and buttons to
 * end and execute code in them
 */
function listSessions(sessions) {
  let list = document.querySelector('#sessions .list')
  if (!list) {
    const sessions = elem(
      `<div id="sessions">
        <h3>Sessions</h3>
        <stencila-action-menu>
          <stencila-button class="refresh" size="xsmall" icon="refresh-ccw" icon-only></stencila-button>
        </stencila-action-menu>
        <div class="list"></div>
      </div>`
    )
    sessions.querySelector('.refresh').onclick = () => update()
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
    item.querySelector('.client').onclick = () =>
      window.open(`/public/client.html?session=${id}&jwt=${jwt}`, '_blank')
    item.querySelector('.end').onclick = () => endSession(node)

    list.appendChild(item)
  }
}

/**
 * List peers
 */
function listPeers(peers) {
  let list = document.querySelector('#peers .list')
  if (!list) {
    const peers = elem(
      `<div id="peers">
        <h3>Peers</h3>
        <stencila-action-menu>
          <stencila-button class="refresh" size="xsmall" icon="refresh-ccw" icon-only></stencila-button>
        </stencila-action-menu>
        <div class="list"></div>
      </div>`
    )
    peers.querySelector('.refresh').onclick = () => update()
    list = peers.querySelector('#peers .list')
    document.body.appendChild(peers)
  } else {
    while (list.firstChild) list.removeChild(list.firstChild)
  }

  for (const peer of peers) {
    const { manifest } = peer
    const {
      id,
      addresses: { ws = {} }
    } = manifest
    const item = elem(
      `<div class="peer" id="${id}">
        <code>${id}</code> ${ws.host}:${ws.port}
      </div>`
    )
    list.appendChild(item)
  }
}

/**
 * Start with update and repeat every x seconds
 */
update()
setInterval(update, 15 * 1000)

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
    name: 'stencila/sparkla-ubuntu'
  }
}

/**
 * Begin a session
 *
 * @param session A `SoftwareSession` node with details of the
 *                session to start
 */
async function beginSession(sessionNode) {
  try {
    sessionNode = await executor.begin(sessionNode)
    log.info(`Began ${sessionNode.name}`)
  } catch (error) {
    log.error(error)
  }
  update()
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
  try {
    sessionNode = await executor.end(sessionNode)
    log.info(`Ended ${sessionNode.name}`)
  } catch (error) {
    log.error(error)
  }
  update()
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
  const { node: sessionNode } = sessionInfo
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
  selectedElem.querySelector(
    'stencila-code-chunk'
  ).executeHandler = async codeChunk => {
    try {
      const result = await executor.execute(codeChunk, sessionNode)
      console.log('Executed', result)
      return result
    } catch (error) {
      log.error(error)
    }
  }
}
