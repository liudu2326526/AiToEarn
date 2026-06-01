import { useEffect, useRef } from 'react'
import { getXhsTokenRefreshJobs } from '@/api/plat/publish'
import { useUserStore } from '@/store/user'

function getPluginApiBaseUrl() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiBaseUrl)
    return undefined

  if (apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://'))
    return apiBaseUrl

  if (typeof window === 'undefined')
    return apiBaseUrl

  return new URL(apiBaseUrl, window.location.origin).toString()
}

function dispatchRefreshJobs(jobs: Array<{
  noteId: string
  publishRecordId: string
  scanLatest?: boolean
  publishTime?: number
}>) {
  if (typeof window === 'undefined' || jobs.length === 0)
    return

  const authToken = useUserStore.getState().token
  if (!authToken) {
    console.warn('[useXhsTokenRefresh] Missing auth token, skip refresh jobs')
    return
  }

  const apiBaseUrl = getPluginApiBaseUrl()

  // 限制并发数量，每次最多处理 5 个任务
  const batchSize = 5
  const batch = jobs.slice(0, batchSize)

  for (const job of batch) {
    window.postMessage({
      type: 'request',
      action: 'MULTIPOST_EXTENSION_REFRESH_XHS_TOKEN',
      traceId: `xhs-token-refresh-${job.publishRecordId}-${Date.now()}`,
      data: {
        noteId: job.noteId,
        publishRecordId: job.publishRecordId,
        scanLatest: job.scanLatest,
        publishTime: job.publishTime,
        apiBaseUrl,
        authToken,
      },
    }, window.location.origin)
  }

  if (jobs.length > batchSize) {
    console.log(`[useXhsTokenRefresh] Batched ${batchSize} of ${jobs.length} jobs, remaining will be processed in next poll`)
  }
}

async function fetchAndDispatchJobs(label: string) {
  const response = await getXhsTokenRefreshJobs()

  if (!response || response.code !== 0) {
    console.warn('[useXhsTokenRefresh] API returned non-zero code:', response?.code)
    return
  }

  const jobs = response.data || []
  if (jobs.length > 0) {
    console.log(`[useXhsTokenRefresh] ${label} found ${jobs.length} refresh jobs`)
    dispatchRefreshJobs(jobs)
  }
}

/**
 * 小红书 Token 自动刷新 Hook
 *
 * 功能：
 * 1. 每 60 秒轮询后端获取待刷新的 token 任务
 * 2. 通过 postMessage 通知 MultiPost 扩展处理刷新
 * 3. 扩展会在小红书创作者页面提取带 token 的链接并回传给后端
 * 4. 每次最多处理 5 个任务，避免并发过高
 */
export function useXhsTokenRefresh() {
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const handleExtensionResponse = (event: MessageEvent) => {
      if (event.origin !== window.location.origin)
        return

      const response = event.data
      if (
        response?.type !== 'response'
        || response?.action !== 'MULTIPOST_EXTENSION_REFRESH_XHS_TOKEN'
      ) {
        return
      }

      const result = response.data
      if (response.code === 0 && result?.success !== false) {
        if (result?.detailFallback) {
          console.log('[useXhsTokenRefresh] XHS token refreshed via detail fallback:', result.noteLink?.noteId)
        }
        return
      }

      const message = response.code === 403
        ? '浏览器插件未信任当前站点，请在插件设置中允许 127.0.0.1。'
        : result?.error || result?.message || response.message || '扩展未返回失败原因'

      console.warn('[useXhsTokenRefresh] Extension failed to refresh XHS token:', {
        traceId: response.traceId,
        message,
        response,
      })
    }

    window.addEventListener('message', handleExtensionResponse)

    // 每 60 秒轮询一次（从 30 秒改为 60 秒，减少无效请求）
    intervalRef.current = setInterval(async () => {
      try {
        await fetchAndDispatchJobs('Polling')
      }
      catch (error) {
        console.error('[useXhsTokenRefresh] Failed to fetch jobs:', error)
      }
    }, 60000) // 60 秒

    // 立即执行一次
    ;(async () => {
      try {
        await fetchAndDispatchJobs('Initial check')
      }
      catch (error) {
        console.error('[useXhsTokenRefresh] Initial fetch failed:', error)
      }
    })()

    return () => {
      window.removeEventListener('message', handleExtensionResponse)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])
}
