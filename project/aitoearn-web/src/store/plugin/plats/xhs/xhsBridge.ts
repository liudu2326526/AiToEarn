import type { PlatformRequestParams } from '../../types/baseTypes'
import { callAutoclawBridge, getAutoclawBridgeStatus, getXhsCaptureSetupMessage, XHS_CAPTURE_SETUP_MESSAGE } from './autoclawBridge'

export { callAutoclawBridge, getXhsCaptureSetupMessage, XHS_CAPTURE_SETUP_MESSAGE }

export interface XhsBridgeStatus {
  serverRunning: boolean
  extensionConnected: boolean
  legacyPluginAvailable: boolean
  ready: boolean
  message?: string
}

export function isLegacyXhsPluginAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.AIToEarnPlugin?.xhsRequest
}

export async function getXhsBridgeStatus(): Promise<XhsBridgeStatus> {
  const autoclawStatus = await getAutoclawBridgeStatus()
  const legacyPluginAvailable = isLegacyXhsPluginAvailable()

  return {
    ...autoclawStatus,
    legacyPluginAvailable,
    ready: autoclawStatus.serverRunning && autoclawStatus.extensionConnected,
    message: autoclawStatus.message,
  }
}

export async function ensureXhsCaptureBridgeReady(): Promise<XhsBridgeStatus> {
  const status = await getXhsBridgeStatus()
  if (!status.ready) {
    throw new Error(status.message || getXhsCaptureSetupMessage())
  }
  return status
}

export async function requestLegacyXhsApi<T = unknown>(params: PlatformRequestParams): Promise<T> {
  if (!isLegacyXhsPluginAvailable()) {
    throw new Error(getXhsCaptureSetupMessage('当前功能需要 AiToEarn 插件的小红书请求能力'))
  }

  return window.AIToEarnPlugin!.xhsRequest<T>(params)
}
