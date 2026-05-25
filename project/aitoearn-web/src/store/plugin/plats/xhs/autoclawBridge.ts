const DEFAULT_BRIDGE_URL = 'ws://localhost:9333'

export const XHS_CAPTURE_SETUP_MESSAGE
  = '小红书内容抓取需要配置 AitoBee XHS Bridge：1. 启动 AitoBee 本地后端；2. 在 Chrome 开发者模式加载 project/aitoearn-extension/xhs-bridge 扩展；3. 在同一个浏览器登录小红书后重试。'

export interface AutoclawBridgeStatus {
  serverRunning: boolean
  extensionConnected: boolean
  message?: string
}

interface BridgeResponse<T> {
  result?: T
  error?: string
}

export function getXhsCaptureSetupMessage(extra?: string): string {
  return extra ? `${extra}。${XHS_CAPTURE_SETUP_MESSAGE}` : XHS_CAPTURE_SETUP_MESSAGE
}

export async function callAutoclawBridge<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
  timeoutMs = 90000,
): Promise<T> {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    throw new Error(getXhsCaptureSetupMessage('当前环境不支持连接本地 XHS Bridge'))
  }

  return await new Promise<T>((resolve, reject) => {
    const socket = new WebSocket(DEFAULT_BRIDGE_URL)
    const timer = window.setTimeout(() => {
      socket.close()
      reject(new Error(`XHS Bridge 命令超时：${method}`))
    }, timeoutMs)

    socket.onopen = () => {
      socket.send(JSON.stringify({
        id: `${method}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'cli',
        method,
        ...(params ? { params } : {}),
      }))
    }

    socket.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error(getXhsCaptureSetupMessage('无法连接本机 XHS Bridge')))
    }

    socket.onmessage = (event) => {
      window.clearTimeout(timer)

      try {
        const response = JSON.parse(event.data) as BridgeResponse<T>
        if (response.error) {
          reject(new Error(getXhsCaptureSetupMessage(response.error)))
          return
        }
        resolve(response.result as T)
      }
      catch (error) {
        reject(error instanceof Error ? error : new Error('XHS Bridge 返回数据解析失败'))
      }
      finally {
        socket.close()
      }
    }
  })
}

export async function getAutoclawBridgeStatus(): Promise<AutoclawBridgeStatus> {
  try {
    const result = await callAutoclawBridge<{ extension_connected?: boolean }>('ping_server', undefined, 5000)
    return {
      serverRunning: true,
      extensionConnected: !!result?.extension_connected,
      message: result?.extension_connected ? undefined : getXhsCaptureSetupMessage('XHS Bridge 已启动，但浏览器扩展未连接'),
    }
  }
  catch (error) {
    return {
      serverRunning: false,
      extensionConnected: false,
      message: error instanceof Error ? error.message : getXhsCaptureSetupMessage('XHS Bridge 未就绪'),
    }
  }
}
