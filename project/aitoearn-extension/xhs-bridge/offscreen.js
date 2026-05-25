const BRIDGE_URL = 'ws://127.0.0.1:9333'
const RECONNECT_DELAY_MS = 1500

let socket
let reconnectTimer
let extensionVersion = '0.1.0'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') {
    return false
  }

  if (message.extensionVersion) {
    extensionVersion = message.extensionVersion
  }

  if (message.type === 'AITOBEE_XHS_CONNECT') {
    connect()
    sendResponse(getConnectionStatus())
    return true
  }

  if (message.type === 'AITOBEE_XHS_STATUS') {
    sendResponse(getConnectionStatus())
    return true
  }

  return false
})

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }

  socket = new WebSocket(BRIDGE_URL)

  socket.addEventListener('open', () => {
    sendToBridge({
      id: `extension-${Date.now()}`,
      role: 'extension',
      name: 'AitoBee XHS Bridge',
      version: extensionVersion,
    })
    updateBadge(true)
  })

  socket.addEventListener('message', async (event) => {
    const message = parseJson(event.data)
    if (!message?.id || !message.method) {
      return
    }

    try {
      const response = await chrome.runtime.sendMessage({
        target: 'background',
        type: 'AITOBEE_XHS_COMMAND',
        method: message.method,
        params: message.params || {},
      })

      if (response?.error) {
        sendToBridge({ id: message.id, error: response.error })
        return
      }

      sendToBridge({ id: message.id, result: response?.result })
    }
    catch (error) {
      sendToBridge({
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  socket.addEventListener('close', scheduleReconnect)
  socket.addEventListener('error', scheduleReconnect)
}

function scheduleReconnect() {
  updateBadge(false)
  if (reconnectTimer) {
    return
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    connect()
  }, RECONNECT_DELAY_MS)
}

function getConnectionStatus() {
  return {
    bridgeUrl: BRIDGE_URL,
    connected: socket?.readyState === WebSocket.OPEN,
    connecting: socket?.readyState === WebSocket.CONNECTING,
  }
}

function sendToBridge(payload) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload))
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value)
  }
  catch {
    return undefined
  }
}

function updateBadge(connected) {
  chrome.runtime.sendMessage({
    target: 'background',
    type: 'AITOBEE_XHS_BADGE',
    connected,
  }).catch(() => {})
}

connect()
