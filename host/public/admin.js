/* eslint-disable */

const { HttpClient } = executa

/**
 * An HTTP client to connect to the `Manager`.
 *
 * Not using a `WebSocketClient` here because that will
 * close any newly created sessions on disconnect which
 * is undesirable for this app.
 *
 * Not using a `BaseExecutor` since we just want to send
 * requests to the `Manager` and don't need to delegate
 * to in-browser executors (e.g. JS or WASM).
 */

const jwt = new URLSearchParams(window.location.search).get('token')

const executor = new HttpClient({
  host: window.location.hostname,
  port: window.location.port,
  jwt
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
      Authorization: `Bearer ${jwt}`
    }
  })
  const sessions = await response.json()

  let list = document.querySelector('#sessions')
  if (!list) {
    list = elem('<div id="sessions"></div>')
    document.body.appendChild(list)
  } else {
    while (list.firstChild) list.removeChild(list.firstChild)
  }
  for (const id in sessions) {
    const sessionInfo = sessions[id]
    const { node } = sessionInfo
    const { name } = node
    const item = elem(
      `<div class="session" id="${id}">
        <stencila-action-menu>
          <stencila-button class="end" size="xsmall" icon="x-square">End</stencila-button>
          <stencila-button class="select" size="xsmall" icon="circle">Select</stencila-button>
        </stencila-action-menu>
        <details>
          <summary>${name}</summary>
          <pre><code>${JSON.stringify(sessionInfo, null, '  ')}</code></pre>
        </details>
      </div>`
    )

    item.querySelector('.end').onclick = () => endSession(id)
    item.querySelector('.select').onclick = () => selectSession(node)

    list.appendChild(item)
  }
}

/**
 * Start by listing sessions
 */
listSessions()

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
    <div>
      <textarea rows="10" cols="80">
{
  "type": "SoftwareSession"
}
      </textarea>
      <stencila-button class="begin" size="xsmall" icon="play">Begin</stencila-button>
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
const detailsElem = elem(`
  <div class="details">
    <h3 class="name">No session selected</h3>
  </div>
`)
document.body.appendChild(detailsElem)

/**
 * A code chunk web component for executing
 * code within a selected session
 */
const codeChunkComp = elem(`
    <stencila-code-chunk
      itemtype="stencila:CodeChunk"
      data-collapsed="false"
      data-programmingLanguage="python"
    >
      <pre slot="text"><code></code></pre>
    </stencila-code-chunk>`)
detailsElem.appendChild(codeChunkComp)

/**
 * Select a session to display in details
 *
 * @param id The id of the session
 */
function selectSession(sessionNode) {
  const { name } = sessionNode
  detailsElem.querySelector('.name').innerText = name
  // Attach the session to the web component
  codeChunkComp.executeHandler = codeChunk => {
    return executor.execute(codeChunk, sessionNode)
  }
}
