import type { ProgressCallback, PublishParams, PublishResult } from './types/baseTypes'

const MULTIPOST_REQUEST_TIMEOUT = 5000
const MULTIPOST_IMAGE_PLATFORM = {
  name: 'DYNAMIC_REDNOTE',
  injectUrl: 'https://creator.xiaohongshu.com/publish/publish?target=image',
  extraConfig: {},
} as const
const MULTIPOST_VIDEO_PLATFORM = {
  name: 'VIDEO_REDNOTE',
  injectUrl: 'https://creator.xiaohongshu.com/publish/publish?target=video',
  extraConfig: {},
} as const
const MULTIPOST_XHS_ACCOUNT_UID = 'multipost-rednote'

type MultiPostAction
  = | 'MULTIPOST_EXTENSION_CHECK_SERVICE_STATUS'
    | 'MULTIPOST_EXTENSION_REQUEST_TRUST_DOMAIN'
    | 'MULTIPOST_EXTENSION_PUBLISH_NOW'

interface MultiPostExternalRequest<T> {
  type: 'request'
  traceId: string
  action: MultiPostAction
  data: T
}

interface MultiPostExternalResponse<T> {
  type: 'response'
  traceId: string
  action: MultiPostAction
  code: number
  message: string
  data: T
}

interface MultiPostFileData {
  name: string
  url: string
  type?: string
  size?: number
}

interface MultiPostSyncDataPlatform {
  name: string
  injectUrl: string
  extraConfig: Record<string, unknown>
}

interface MultiPostDynamicData {
  title: string
  content: string
  images: MultiPostFileData[]
  videos: MultiPostFileData[]
  tags?: string[]
  scheduledPublishTime?: number
}

interface MultiPostVideoData {
  title: string
  content: string
  video: MultiPostFileData
  cover?: MultiPostFileData
  tags?: string[]
  scheduledPublishTime?: number
}

export interface MultiPostSyncData {
  platforms: MultiPostSyncDataPlatform[]
  isAutoPublish: boolean
  data: MultiPostDynamicData | MultiPostVideoData
}

interface MultiPostProbeResult {
  installed: boolean
  trusted: boolean
}

interface MultiPostPublishAcceptedResult {
  accepted?: boolean
  traceId?: string
  tabs?: unknown[]
  error?: string
}

function createTraceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `multipost_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function isMultiPostResponse<T>(
  value: unknown,
  traceId: string,
  action: MultiPostAction,
): value is MultiPostExternalResponse<T> {
  return !!value
    && typeof value === 'object'
    && (value as MultiPostExternalResponse<T>).type === 'response'
    && (value as MultiPostExternalResponse<T>).traceId === traceId
    && (value as MultiPostExternalResponse<T>).action === action
}

function getFileNameFromUrl(url: string, fallback: string) {
  try {
    const pathname = new URL(url).pathname
    const fileName = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '')
    return fileName || fallback
  }
  catch {
    const [withoutQuery] = url.split('?')
    const fileName = decodeURIComponent(withoutQuery.split('/').filter(Boolean).pop() || '')
    return fileName || fallback
  }
}

function getMimeTypeFromName(name: string, fallback: string) {
  const extension = name.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'mov':
      return 'video/quicktime'
    case 'mp4':
      return 'video/mp4'
    case 'webm':
      return 'video/webm'
    default:
      return fallback
  }
}

function isFile(value: File | string): value is File {
  return typeof File !== 'undefined' && value instanceof File
}

function toMultiPostFileData(input: File | string, fallbackName: string, fallbackMimeType: string) {
  if (isFile(input)) {
    if (!URL.createObjectURL) {
      throw new Error('当前浏览器不支持本地文件发布，请先上传素材后再发布')
    }

    return {
      name: input.name || fallbackName,
      url: URL.createObjectURL(input),
      type: input.type || fallbackMimeType,
      size: input.size,
    }
  }

  const name = getFileNameFromUrl(input, fallbackName)
  return {
    name,
    url: input,
    type: getMimeTypeFromName(name, fallbackMimeType),
  }
}

function normalizeTopics(topics?: string[]) {
  const normalized = (topics || [])
    .map(topic => topic.trim().replace(/^#|#$/g, ''))
    .filter(Boolean)

  return normalized.length > 0 ? [...new Set(normalized)] : undefined
}

export function canUseMultiPost(params: PublishParams) {
  return params.platform === 'xhs'
}

export function buildMultiPostXhsAccountData(spaceId?: string) {
  return {
    type: 'xhs',
    uid: MULTIPOST_XHS_ACCOUNT_UID,
    account: MULTIPOST_XHS_ACCOUNT_UID,
    loginCookie: 'multipost-extension',
    avatar: '',
    nickname: 'Rednote (MultiPost)',
    fansCount: 0,
    status: 1,
    clientType: 'web',
    ...(spaceId ? { groupId: spaceId } : {}),
  }
}

export function buildMultiPostSyncData(params: PublishParams): MultiPostSyncData {
  if (!canUseMultiPost(params)) {
    throw new Error('MultiPost adapter only supports Xhs publishing')
  }

  const tags = normalizeTopics(params.topics)
  if (params.type === 'video') {
    if (!params.video) {
      throw new Error('小红书视频发布缺少视频素材')
    }

    const data: MultiPostVideoData = {
      title: params.title || '',
      content: params.desc || '',
      video: toMultiPostFileData(params.video, 'video.mp4', 'video/mp4'),
      cover: params.cover
        ? toMultiPostFileData(params.cover, 'cover.jpg', 'image/jpeg')
        : undefined,
      tags,
      scheduledPublishTime: params.scheduledTime,
    }
    if (!data.cover)
      delete data.cover
    if (!data.tags)
      delete data.tags
    if (!data.scheduledPublishTime)
      delete data.scheduledPublishTime

    return {
      platforms: [MULTIPOST_VIDEO_PLATFORM],
      isAutoPublish: true,
      data,
    }
  }

  const images = params.images || []
  if (images.length === 0) {
    throw new Error('小红书图文发布缺少图片素材')
  }

  const data: MultiPostDynamicData = {
    title: params.title || '',
    content: params.desc || '',
    images: images.map((image, index) =>
      toMultiPostFileData(image, `image-${index + 1}.png`, 'image/png')),
    videos: [],
    tags,
    scheduledPublishTime: params.scheduledTime,
  }
  if (!data.tags)
    delete data.tags
  if (!data.scheduledPublishTime)
    delete data.scheduledPublishTime

  return {
    platforms: [MULTIPOST_IMAGE_PLATFORM],
    isAutoPublish: true,
    data,
  }
}

async function sendMultiPostRequest<TData, TResult>(
  action: MultiPostAction,
  data: TData,
  timeout = MULTIPOST_REQUEST_TIMEOUT,
  traceIdOverride?: string,
) {
  if (typeof window === 'undefined') {
    throw new TypeError('MultiPost extension is only available in browser')
  }

  const traceId = traceIdOverride || createTraceId()
  const request: MultiPostExternalRequest<TData> = {
    type: 'request',
    traceId,
    action,
    data,
  }

  return await new Promise<MultiPostExternalResponse<TResult>>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      reject(new Error('未检测到 MultiPost 浏览器插件'))
    }, timeout)

    function handleMessage(event: MessageEvent) {
      if (event.source !== window)
        return

      if (!isMultiPostResponse<TResult>(event.data, traceId, action))
        return

      window.clearTimeout(timer)
      window.removeEventListener('message', handleMessage)
      resolve(event.data)
    }

    window.addEventListener('message', handleMessage)
    window.postMessage(request, window.location.origin)
  })
}

export async function probeMultiPostExtension(): Promise<MultiPostProbeResult> {
  try {
    const response = await sendMultiPostRequest<null, { extensionId?: string }>(
      'MULTIPOST_EXTENSION_CHECK_SERVICE_STATUS',
      null,
      1500,
    )

    return {
      installed: response.code === 0 || response.code === 403,
      trusted: response.code === 0,
    }
  }
  catch {
    return {
      installed: false,
      trusted: false,
    }
  }
}

export async function requestMultiPostTrustDomain() {
  const response = await sendMultiPostRequest<null, { trusted?: boolean }>(
    'MULTIPOST_EXTENSION_REQUEST_TRUST_DOMAIN',
    null,
    60_000,
  )

  return response.code === 0 && !!response.data?.trusted
}

export async function publishWithMultiPost(
  params: PublishParams,
  onProgress?: ProgressCallback,
): Promise<PublishResult> {
  onProgress?.({
    stage: 'download',
    progress: 10,
    message: '准备调用 MultiPost 发布...',
    timestamp: Date.now(),
  })

  const probe = await probeMultiPostExtension()
  if (!probe.installed) {
    throw new Error('请先安装 MultiPost 浏览器插件')
  }

  if (!probe.trusted) {
    const trusted = await requestMultiPostTrustDomain()
    if (!trusted) {
      throw new Error('MultiPost 未授权当前网页，请先完成域名授权')
    }
  }

  onProgress?.({
    stage: 'publish',
    progress: 60,
    message: '正在交给 MultiPost 扩展处理...',
    timestamp: Date.now(),
  })

  const syncData = buildMultiPostSyncData(params)
  const response = await sendMultiPostRequest<MultiPostSyncData, MultiPostPublishAcceptedResult>(
    'MULTIPOST_EXTENSION_PUBLISH_NOW',
    syncData,
    10_000,
    params.requestId,
  )

  if (response.code !== 0 || response.data?.accepted === false) {
    throw new Error(response.data?.error || response.message || 'MultiPost 发布任务创建失败')
  }

  onProgress?.({
    stage: 'complete',
    progress: 100,
    message: 'MultiPost 已接收发布任务，正在等待小红书页面返回最终结果',
    timestamp: Date.now(),
  })

  return {
    success: true,
    workId: params.requestId || response.data?.traceId || `multipost-${Date.now()}`,
    publishTime: Date.now(),
    platformData: {
      provider: 'multipost',
      accepted: true,
      traceId: response.data?.traceId,
      tabs: response.data?.tabs,
    },
  }
}
