// 获取完整的OSS URL
export function getOssUrl(path?: string) {
  if (!path)
    return ''

  const baseUrl = process.env.NEXT_PUBLIC_OSS_URL

  if (baseUrl) {
    const publicBaseUrl = baseUrl.replace(/\/$/, '')
    try {
      const url = new URL(path)
      const isLocalObjectStorage = ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '9000'
      if (isLocalObjectStorage) {
        const [, bucket, ...objectPathParts] = url.pathname.split('/')
        if (bucket && objectPathParts.length > 0)
          return `${publicBaseUrl}/${objectPathParts.join('/')}`
      }
    }
    catch {
      // Not an absolute URL; relative object paths are handled below.
    }
  }

  if (
    path.startsWith('http')
    || path.startsWith('https')
    || path.startsWith('ossProxy')
    || path.startsWith('/ossProxy/')
    || path.startsWith('blob:http')
    || path.startsWith('blob:https')
  ) {
    return path
  }

  if (!baseUrl)
    return path

  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

// 将完整的oss url转为代理的 oss url
export function getOssProxyPath(ossUrl?: string) {
  if (!ossUrl)
    return ''

  return ossUrl?.replace(
    process.env.NEXT_PUBLIC_OSS_URL ?? '',
    process.env.NEXT_PUBLIC_OSS_URL_PROXY ?? '',
  )
}
