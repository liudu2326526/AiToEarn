#!/usr/bin/env node

const http = require('node:http')

const host = process.env.AITOEARN_PROXY_HOST || '127.0.0.1'
const port = Number(process.env.AITOEARN_PROXY_PORT || 7001)
const serverTarget = process.env.AITOEARN_SERVER_URL || 'http://127.0.0.1:3002'
const aiTarget = process.env.AITOEARN_AI_URL || 'http://127.0.0.1:3010'

const routes = [
  { prefix: '/api/ai/', target: aiTarget, stripPrefix: '/api' },
  { prefix: '/api/agent/', target: aiTarget, stripPrefix: '/api' },
  { prefix: '/api/', target: serverTarget, stripPrefix: '/api' },
]

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,x-requested-with',
    'access-control-allow-credentials': 'true',
  }
}

function resolveRoute(url) {
  return routes.find((route) => url.startsWith(route.prefix))
}

function rewriteUrl(url, route) {
  if (!route.stripPrefix || !url.startsWith(route.stripPrefix)) {
    return url
  }

  const rewritten = url.slice(route.stripPrefix.length)
  return rewritten.startsWith('/') ? rewritten : `/${rewritten}`
}

const server = http.createServer((req, res) => {
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    res.setHeader(key, value)
  })

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const route = resolveRoute(req.url || '/')
  if (!route) {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: 'No local proxy route matched' }))
    return
  }

  const targetUrl = new URL(rewriteUrl(req.url || '/', route), route.target)
  const proxyReq = http.request(
    targetUrl,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, {
        ...proxyRes.headers,
        ...corsHeaders(),
      })
      proxyRes.pipe(res)
    },
  )

  proxyReq.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        message: 'Local proxy upstream request failed',
        upstream: route.target,
        error: error.message,
      }),
    )
  })

  req.pipe(proxyReq)
})

server.listen(port, host, () => {
  console.log(`AitoBee local API proxy listening on http://${host}:${port}`)
  console.log(`- /api/ai/* and /api/agent/* -> ${aiTarget}`)
  console.log(`- /api/* -> ${serverTarget}`)
})
