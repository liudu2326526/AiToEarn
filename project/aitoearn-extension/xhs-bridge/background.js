const XHS_ORIGIN = 'https://www.xiaohongshu.com'
const OFFSCREEN_URL = 'offscreen.html'

let creatingOffscreen
let currentXhsTabId

chrome.runtime.onInstalled.addListener(() => {
  ensureOffscreenDocument()
})

chrome.runtime.onStartup.addListener(() => {
  ensureOffscreenDocument()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'background') {
    return false
  }

  if (message.type === 'AITOBEE_XHS_CONNECT') {
    handlePopupConnect().then(sendResponse)
    return true
  }

  if (message.type === 'AITOBEE_XHS_STATUS') {
    sendToOffscreen({ type: 'AITOBEE_XHS_STATUS' }).then(sendResponse)
    return true
  }

  if (message.type === 'AITOBEE_XHS_BADGE') {
    updateBadge(!!message.connected)
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'AITOBEE_XHS_COMMAND') {
    handleCommand(message.method, message.params || {})
      .then(result => sendResponse({ result }))
      .catch(error => sendResponse({ error: error instanceof Error ? error.message : String(error) }))
    return true
  }

  return false
})

async function handlePopupConnect() {
  await ensureOffscreenDocument()
  return sendToOffscreen({ type: 'AITOBEE_XHS_CONNECT' })
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen?.createDocument) {
    return false
  }

  if (await hasOffscreenDocument()) {
    return true
  }

  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['WORKERS'],
      justification: 'Keep a local WebSocket connection to the AitoBee XHS Bridge while the extension is enabled.',
    }).finally(() => {
      creatingOffscreen = undefined
    })
  }

  await creatingOffscreen
  return true
}

async function hasOffscreenDocument() {
  if (!chrome.runtime.getContexts) {
    return false
  }

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  })
  return contexts.length > 0
}

async function sendToOffscreen(message) {
  await ensureOffscreenDocument()
  return chrome.runtime.sendMessage({
    target: 'offscreen',
    extensionVersion: chrome.runtime.getManifest().version,
    ...message,
  })
}

async function handleCommand(method, params) {
  switch (method) {
    case 'navigate':
      return navigate(params.url)
    case 'wait_for_load':
      return waitForLoad(Number(params.timeout || 60000))
    case 'wait_dom_stable':
      return waitDomStable(Number(params.timeout || 10000), Number(params.interval || 500))
    case 'evaluate':
      return evaluate(String(params.expression || ''))
    default:
      throw new Error(`Unsupported XHS Bridge method: ${method}`)
  }
}

async function navigate(url) {
  if (!url || !url.startsWith(XHS_ORIGIN)) {
    throw new Error('只允许打开小红书页面')
  }

  const tab = await getOrCreateXhsTab()
  const updatedTab = await chrome.tabs.update(tab.id, { url, active: true })
  currentXhsTabId = updatedTab.id
  return { tabId: currentXhsTabId }
}

async function getOrCreateXhsTab() {
  if (currentXhsTabId) {
    try {
      const tab = await chrome.tabs.get(currentXhsTabId)
      if (tab?.id) {
        return tab
      }
    }
    catch {
      currentXhsTabId = undefined
    }
  }

  const tabs = await chrome.tabs.query({ url: `${XHS_ORIGIN}/*` })
  if (tabs[0]?.id) {
    currentXhsTabId = tabs[0].id
    return tabs[0]
  }

  const tab = await chrome.tabs.create({ url: XHS_ORIGIN, active: true })
  currentXhsTabId = tab.id
  return tab
}

async function getTargetTabId() {
  if (currentXhsTabId) {
    return currentXhsTabId
  }
  const tab = await getOrCreateXhsTab()
  if (!tab.id) {
    throw new Error('没有可用的小红书标签页')
  }
  currentXhsTabId = tab.id
  return tab.id
}

async function waitForLoad(timeoutMs) {
  const tabId = await getTargetTabId()
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId)
    if (tab.status === 'complete') {
      return { loaded: true }
    }
    await sleep(250)
  }

  throw new Error('等待小红书页面加载超时')
}

async function waitDomStable(timeoutMs, intervalMs) {
  const tabId = await getTargetTabId()
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (timeout, interval) => {
      const getSignature = () => `${document.body?.innerText?.length || 0}:${document.images.length}:${document.querySelectorAll('*').length}`
      const deadline = Date.now() + timeout
      let lastSignature = ''
      let stableCount = 0

      while (Date.now() < deadline) {
        const signature = getSignature()
        if (signature === lastSignature) {
          stableCount += 1
          if (stableCount >= 2) {
            return true
          }
        }
        else {
          stableCount = 0
          lastSignature = signature
        }
        await new Promise(resolve => setTimeout(resolve, interval))
      }
      return true
    },
    args: [timeoutMs, intervalMs],
  })

  return { stable: Boolean(results[0]?.result) }
}

async function evaluate(expression) {
  if (!expression.trim()) {
    throw new Error('evaluate expression 不能为空')
  }

  const tabId = await getTargetTabId()
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (code) => {
      return globalThis.eval(code)
    },
    args: [expression],
  })

  return results[0]?.result
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function updateBadge(connected) {
  chrome.action.setBadgeText({ text: connected ? 'ON' : '' })
  chrome.action.setBadgeBackgroundColor({ color: connected ? '#0ea5e9' : '#94a3b8' })
}
