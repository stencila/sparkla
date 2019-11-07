/* eslint-disable */

/**
 * Create a element from HTML
 */
function elem(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.firstElementChild
}

/**
 * Add a notification that will disappear after some time
 */
async function addNotification(level, message, node) {
  let list = document.querySelector('#notifications')
  if (!list) {
    list = elem('<div id="notifications"></div>')
    document.body.appendChild(list)
  }

  const icon =
    {
      debug: 'life-buoy',
      info: 'info',
      warn: 'alert-triangle',
      error: 'alert-octogon'
    }[level] || 'circle'
  const item = elem(
    `<div class="notification ${level}">
      <stencila-icon icon="${icon}"></stencila-icon>
      ${message}
      <stencila-icon class="close" icon="x"></stencila-icon>
    </div>`
  )
  const remove = () => item.remove()
  item.querySelector('.close').onclick = remove
  setTimeout(remove, 10000)

  list.appendChild(item)
}
