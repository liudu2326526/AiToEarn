import {
  buildXhsDomReplyTarget,
  buildXhsReplyBody,
  normalizeXhsDomReplyResponse,
  normalizeXhsReplyResponse,
  validateReplyParams,
} from './reply-payload.js'

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
    case 'post_comment_reply':
      return postCommentReply(params)
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

async function postCommentReply(rawParams) {
  const params = validateReplyParams(rawParams)
  const tab = await getOrCreateXhsTab()

  if (!tab.id) {
    throw new Error('没有可用的小红书标签页')
  }

  await chrome.tabs.update(tab.id, { url: params.postUrl, active: params.visibleTab })
  currentXhsTabId = tab.id
  await waitForLoad(60000)
  await waitDomStable(10000, 500)

  const domResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: postXhsReplyViaDom,
    args: [buildXhsDomReplyTarget(params)],
  })

  const domResult = normalizeXhsDomReplyResponse(domResults[0]?.result)
  const normalized = domResult.success
    ? domResult
    : await postXhsReplyViaApi(tab.id, params, domResult.message)
  const shouldCaptureScreenshot = params.screenshotPolicy === 'always'
    || (params.screenshotPolicy === 'failure' && !normalized.success)
  const screenshotDataUrl = shouldCaptureScreenshot
    ? await captureXhsVisibleTab(tab)
    : ''

  if (!normalized.success) {
    return {
      ...normalized,
      needHumanAssist: true,
      // signatureRejected changes the operator-facing reason only. The final
      // task status is still human_required for any platform rejection.
      verificationReason: normalized.signatureRejected
        ? '小红书请求签名不可用，需要切换到 DOM 自动化或复用现有插件签名通道'
        : normalized.message,
      screenshotDataUrl,
    }
  }

  return {
    ...normalized,
    screenshotDataUrl,
  }
}

async function postXhsReplyViaApi(tabId, params, domFailureReason) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (body) => {
      // This must execute in the Xiaohongshu page MAIN world so it can use the
      // same fetch environment as the logged-in page. If the page does not expose
      // the signing-patched fetch path, the response is treated as human-required.
      const response = await fetch('/api/sns/web/v1/comment/post', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify(body),
      })

      const text = await response.text()
      let payload
      try {
        payload = JSON.parse(text)
      }
      catch {
        payload = { success: false, msg: text || `HTTP ${response.status}` }
      }

      if (!response.ok) {
        return {
          success: false,
          code: response.status,
          msg: payload?.msg || payload?.message || `HTTP ${response.status}`,
          data: payload?.data,
        }
      }

      return payload
    },
    args: [buildXhsReplyBody(params)],
  })

  const normalized = normalizeXhsReplyResponse(results[0]?.result)
  if (!normalized.success && domFailureReason) {
    normalized.message = `DOM 自动化失败: ${domFailureReason}; API 回退失败: ${normalized.message}`
  }
  return normalized
}

async function postXhsReplyViaDom(target) {
  const sleepInPage = ms => new Promise(resolve => setTimeout(resolve, ms))
  const isVisible = (element) => {
    if (!element) return false
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }
  const visibleText = element => String(element?.innerText || element?.textContent || '').trim()
  const waitFor = async (predicate, timeoutMs = 8000, intervalMs = 150) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const result = predicate()
      if (result) return result
      await sleepInPage(intervalMs)
    }
    return null
  }
  const dispatchTextInput = (input, content) => {
    input.focus()
    if (input.isContentEditable) {
      input.textContent = ''
      document.execCommand?.('insertText', false, content)
      if (visibleText(input) !== content) input.textContent = content
    }
    else {
      const proto = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
      const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      if (valueSetter) valueSetter.call(input, content)
      else input.value = content
    }
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: content,
      inputType: 'insertText',
    }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const findComment = () => {
    for (const selector of target.selectors) {
      const matched = document.querySelector(selector)
      if (matched) return matched.closest('.comment-item') || matched
    }
    return null
  }
  const comment = findComment()
  if (!comment) {
    return { success: false, message: `未找到评论 ${target.commentId}` }
  }

  comment.scrollIntoView({ block: 'center', behavior: 'instant' })
  await sleepInPage(300)

  const replyButton = Array.from(comment.querySelectorAll('button, span, div, a'))
    .find(element => isVisible(element) && visibleText(element) === '回复')
  if (!replyButton) {
    return { success: false, message: `未找到评论 ${target.commentId} 的回复按钮` }
  }
  replyButton.click()

  const input = await waitFor(() => {
    const active = document.activeElement
    if (active && (active.matches?.('textarea,input,[contenteditable="true"]')) && isVisible(active)) {
      return active
    }
    const fields = Array.from(document.querySelectorAll('textarea,input,[contenteditable="true"]'))
      .filter(isVisible)
    return fields[fields.length - 1] || null
  }, 8000)
  if (!input) {
    return { success: false, message: '点击回复后未出现输入框' }
  }

  dispatchTextInput(input, target.content)

  const sendButton = await waitFor(() => {
    return Array.from(document.querySelectorAll('button'))
      .find((button) => {
        const disabled = button.disabled || button.getAttribute('aria-disabled') === 'true'
        return isVisible(button) && !disabled && visibleText(button) === '发送'
      })
  }, 8000)
  if (!sendButton) {
    return { success: false, message: '输入回复后发送按钮不可用' }
  }

  sendButton.click()

  const appeared = await waitFor(() => {
    return document.body?.innerText?.includes(target.content)
  }, 10000, 250)

  if (!appeared) {
    return { success: false, message: '已点击发送，但页面未出现回复内容' }
  }

  return {
    success: true,
    replyId: `dom:${target.commentId}:${Date.now()}`,
    message: 'DOM 自动化回复已发布',
  }
}

async function captureXhsVisibleTab(tab) {
  if (!tab.id || !tab.windowId) return ''
  try {
    await chrome.windows.update(tab.windowId, { focused: true })
    await chrome.tabs.update(tab.id, { active: true })
    await sleep(300)
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
  }
  catch (error) {
    console.warn('[AitoBee XHS Bridge] failed to capture visible tab', error)
    return ''
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function updateBadge(connected) {
  chrome.action.setBadgeText({ text: connected ? 'ON' : '' })
  chrome.action.setBadgeBackgroundColor({ color: connected ? '#0ea5e9' : '#94a3b8' })
}
