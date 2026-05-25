import { describe, expect, it, vi } from 'vitest'
import { XhsBridgeHub } from './xhs-bridge-hub'

class FakeSocket {
  static OPEN = 1
  readyState = FakeSocket.OPEN
  sent: unknown[] = []

  send(payload: string) {
    this.sent.push(JSON.parse(payload))
  }

  close() {
    this.readyState = 3
  }
}

describe('XhsBridgeHub', () => {
  it('reports whether the extension is connected', () => {
    const hub = new XhsBridgeHub()
    const client = new FakeSocket()

    hub.handleClientMessage(client, JSON.stringify({ id: '1', role: 'cli', method: 'ping_server' }))

    expect(client.sent).toEqual([{ id: '1', result: { extension_connected: false } }])

    hub.connectExtension(new FakeSocket())
    hub.handleClientMessage(client, JSON.stringify({ id: '2', role: 'cli', method: 'ping_server' }))

    expect(client.sent.at(-1)).toEqual({ id: '2', result: { extension_connected: true } })
  })

  it('returns a setup error when a command needs the extension but it is not connected', () => {
    const hub = new XhsBridgeHub()
    const client = new FakeSocket()

    hub.handleClientMessage(client, JSON.stringify({ id: '1', role: 'cli', method: 'navigate', params: { url: 'https://www.xiaohongshu.com' } }))

    expect(client.sent).toEqual([{ id: '1', error: 'AitoBee XHS Chrome 扩展未连接' }])
  })

  it('forwards cli commands to the extension and returns the extension result', async () => {
    vi.useFakeTimers()
    const hub = new XhsBridgeHub({ requestTimeoutMs: 1000 })
    const client = new FakeSocket()
    const extension = new FakeSocket()

    hub.connectExtension(extension)
    hub.handleClientMessage(client, JSON.stringify({ id: 'client-1', role: 'cli', method: 'evaluate', params: { expression: '1 + 1' } }))

    expect(extension.sent).toEqual([{ id: 'client-1', method: 'evaluate', params: { expression: '1 + 1' } }])

    hub.handleExtensionMessage(extension, JSON.stringify({ id: 'client-1', result: 2 }))

    await vi.runOnlyPendingTimersAsync()
    expect(client.sent).toEqual([{ id: 'client-1', result: 2 }])
    vi.useRealTimers()
  })
})
