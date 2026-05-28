interface BridgeSocket {
  readyState: number
  send: (payload: string) => void
  close?: () => void
}

interface BridgeMessage {
  id?: string
  role?: 'cli' | 'extension'
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: string
}

interface PendingRequest {
  client: BridgeSocket
  timer: ReturnType<typeof setTimeout>
}

interface DirectRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface XhsBridgeHubOptions {
  requestTimeoutMs?: number
}

const SOCKET_OPEN = 1

export class XhsBridgeHub {
  private extensionSocket?: BridgeSocket
  private readonly pendingRequests = new Map<string, PendingRequest>()
  private readonly directRequests = new Map<string, DirectRequest>()
  private readonly requestTimeoutMs: number

  constructor(options: XhsBridgeHubOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 90000
  }

  connectExtension(socket: BridgeSocket): void {
    this.extensionSocket = socket
  }

  disconnect(socket: BridgeSocket): void {
    if (this.extensionSocket === socket) {
      this.extensionSocket = undefined

      for (const [id, request] of this.directRequests) {
        clearTimeout(request.timer)
        request.reject(new Error('AitoBee XHS Chrome 扩展已断开连接'))
        this.directRequests.delete(id)
      }
    }

    for (const [id, request] of this.pendingRequests) {
      if (request.client === socket) {
        clearTimeout(request.timer)
        this.pendingRequests.delete(id)
      }
    }
  }

  getStatus() {
    return {
      extensionConnected: this.isExtensionConnected(),
    }
  }

  async callExtension<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs = this.requestTimeoutMs,
  ): Promise<T> {
    if (!this.extensionSocket || !this.isOpen(this.extensionSocket)) {
      throw new Error('AitoBee XHS Chrome 扩展未连接')
    }

    const id = "server-" + method + "-" + Date.now() + "-" + Math.random().toString(36).slice(2)

    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.directRequests.delete(id)
        reject(new Error('XHS Bridge 命令超时：' + method))
      }, timeoutMs)

      this.directRequests.set(id, {
        resolve: value => resolve(value as T),
        reject,
        timer,
      })

      this.send(this.extensionSocket!, {
        id,
        method,
        ...(params ? { params } : {}),
      })
    })
  }

  handleClientMessage(socket: BridgeSocket, rawMessage: string): void {
    const message = this.parseMessage(rawMessage)
    if (!message) {
      this.send(socket, { error: '无效的 XHS Bridge 消息' })
      return
    }

    if (message.role === 'extension') {
      this.connectExtension(socket)
      this.send(socket, { id: message.id, result: { connected: true } })
      return
    }

    if (message.method === 'ping_server') {
      this.send(socket, {
        id: message.id,
        result: { extension_connected: this.isExtensionConnected() },
      })
      return
    }

    this.forwardToExtension(socket, message)
  }

  handleExtensionMessage(socket: BridgeSocket, rawMessage: string): void {
    if (socket !== this.extensionSocket) {
      this.handleClientMessage(socket, rawMessage)
      return
    }

    const message = this.parseMessage(rawMessage)
    if (!message?.id) {
      return
    }

    const direct = this.directRequests.get(message.id)
    if (direct) {
      clearTimeout(direct.timer)
      this.directRequests.delete(message.id)
      if (message.error) {
        direct.reject(new Error(message.error))
      }
      else {
        direct.resolve(message.result)
      }
      return
    }

    const pending = this.pendingRequests.get(message.id)
    if (!pending) {
      return
    }

    clearTimeout(pending.timer)
    this.pendingRequests.delete(message.id)
    this.send(pending.client, {
      id: message.id,
      ...(message.error ? { error: message.error } : { result: message.result }),
    })
  }

  private forwardToExtension(client: BridgeSocket, message: BridgeMessage): void {
    if (!message.id || !message.method) {
      this.send(client, { id: message.id, error: 'XHS Bridge 命令缺少 id 或 method' })
      return
    }

    if (!this.extensionSocket || !this.isOpen(this.extensionSocket)) {
      this.send(client, { id: message.id, error: 'AitoBee XHS Chrome 扩展未连接' })
      return
    }

    const timer = setTimeout(() => {
      this.pendingRequests.delete(message.id!)
      this.send(client, { id: message.id, error: `XHS Bridge 命令超时：${message.method}` })
    }, this.requestTimeoutMs)

    this.pendingRequests.set(message.id, { client, timer })
    this.send(this.extensionSocket, {
      id: message.id,
      method: message.method,
      ...(message.params ? { params: message.params } : {}),
    })
  }

  private isExtensionConnected(): boolean {
    return !!this.extensionSocket && this.isOpen(this.extensionSocket)
  }

  private isOpen(socket: BridgeSocket): boolean {
    return socket.readyState === SOCKET_OPEN
  }

  private parseMessage(rawMessage: string): BridgeMessage | undefined {
    try {
      return JSON.parse(rawMessage) as BridgeMessage
    }
    catch {
      return undefined
    }
  }

  private send(socket: BridgeSocket, payload: BridgeMessage): void {
    if (this.isOpen(socket)) {
      socket.send(JSON.stringify(payload))
    }
  }
}
