const statusEl = document.querySelector('#status')
const connectButton = document.querySelector('#connect')

function renderStatus(status) {
  if (!statusEl) {
    return
  }

  if (status?.connected) {
    statusEl.textContent = '已连接 AitoBee'
    return
  }

  if (status?.connecting) {
    statusEl.textContent = '正在连接 AitoBee'
    return
  }

  statusEl.textContent = '未连接 AitoBee'
}

async function sendMessage(type) {
  try {
    const status = await chrome.runtime.sendMessage({ target: 'background', type })
    renderStatus(status)
  }
  catch (error) {
    renderStatus({ connected: false })
    console.error(error)
  }
}

connectButton?.addEventListener('click', () => {
  sendMessage('AITOBEE_XHS_CONNECT')
})

sendMessage('AITOBEE_XHS_CONNECT')
