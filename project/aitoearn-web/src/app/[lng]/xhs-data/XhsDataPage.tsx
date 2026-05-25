'use client'

import Link from 'next/link'
import {
  BarChart3,
  CalendarDays,
  Chrome,
  Eye,
  Heart,
  ImageIcon,
  Loader2,
  MessageSquareText,
  Search,
  Share2,
  Star,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CommentItem, WorkDetail } from '@/store/plugin/plats/types'
import { getXhsBridgeStatus, XHS_CAPTURE_SETUP_MESSAGE } from '@/store/plugin/plats/xhs/xhsBridge'
import { getWorkMonitorViaAutoclawBridge } from '@/store/plugin/plats/xhs/workDetail'

interface BridgeStatus {
  ready: boolean
  serverRunning: boolean
  extensionConnected: boolean
  legacyPluginAvailable: boolean
  message?: string
}

interface ParsedXhsNoteUrl {
  workId: string
  xsecToken: string
  xsecSource: string
}

function parseXhsNoteUrl(input: string): ParsedXhsNoteUrl {
  const trimmed = input.trim()
  const idMatch = trimmed.match(/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/) || trimmed.match(/^([a-zA-Z0-9]{16,})$/)
  const tokenMatch = trimmed.match(/[?&]xsec_token=([^&]+)/)
  const sourceMatch = trimmed.match(/[?&]xsec_source=([^&]+)/)

  return {
    workId: idMatch?.[1] ?? '',
    xsecToken: tokenMatch?.[1] ? decodeURIComponent(tokenMatch[1]) : '',
    xsecSource: sourceMatch?.[1] ? decodeURIComponent(sourceMatch[1]) : 'pc_feed',
  }
}

function formatTimestamp(value?: number): string {
  if (!value)
    return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return '-'

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function toNumber(value: string | number | undefined): number {
  if (value === undefined)
    return 0

  if (typeof value === 'number')
    return value

  const normalized = value.trim()
  if (!normalized)
    return 0

  if (normalized.endsWith('万'))
    return (Number.parseFloat(normalized) || 0) * 10000

  return Number.parseFloat(normalized.replace(/,/g, '')) || 0
}

function compactMetric(value: string | number | undefined): string {
  const numeric = toNumber(value)
  if (numeric >= 10000)
    return `${Number.parseFloat((numeric / 10000).toFixed(2))}万`

  return String(value ?? '0')
}

function getEngagementTotal(detail: WorkDetail): number {
  return toNumber(detail.interactInfo.likeCount)
    + toNumber(detail.interactInfo.collectCount)
    + toNumber(detail.interactInfo.commentCount)
    + toNumber(detail.interactInfo.shareCount)
}

function getEstimatedReadCount(detail: WorkDetail): number {
  const engagement = getEngagementTotal(detail)
  if (!engagement)
    return 0

  // 本地版没有线上平台的曝光模型，先用互动量的经验倍数给出参考值。
  return Math.round(engagement * 16.8)
}

function getBestCover(detail: WorkDetail): string {
  return detail.coverUrl || detail.imageList[0]?.url || ''
}

function getTopComments(comments: CommentItem[]): CommentItem[] {
  return [...comments]
    .sort((a, b) => (b.likeCount + b.replyCount) - (a.likeCount + a.replyCount))
    .slice(0, 5)
}

function MetricCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-sky-500">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  )
}

function MiniTrend({ detail }: { detail: WorkDetail }) {
  const like = toNumber(detail.interactInfo.likeCount)
  const collect = toNumber(detail.interactInfo.collectCount)
  const comment = toNumber(detail.interactInfo.commentCount)
  const share = toNumber(detail.interactInfo.shareCount)
  const max = Math.max(like, collect, comment, share, 1)
  const bars = [
    { label: '点赞', value: like, color: 'bg-rose-400' },
    { label: '收藏', value: collect, color: 'bg-indigo-400' },
    { label: '评论', value: comment, color: 'bg-amber-400' },
    { label: '分享', value: share, color: 'bg-sky-400' },
  ]

  return (
    <div className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">互动分布</h3>
          <p className="mt-1 text-sm text-slate-500">本地插件当前只能获取一次性快照，趋势图先展示本次抓取的互动结构。</p>
        </div>
        <BarChart3 className="h-5 w-5 text-sky-500" />
      </div>
      <div className="mt-5 space-y-4">
        {bars.map(item => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-slate-600">{item.label}</span>
              <span className="font-medium text-slate-900">{compactMetric(item.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorkMonitorResult({ detail, comments }: { detail: WorkDetail, comments: CommentItem[] }) {
  const cover = getBestCover(detail)
  const engagement = getEngagementTotal(detail)
  const estimatedRead = getEstimatedReadCount(detail)
  const topComments = getTopComments(comments)

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[180px_1fr_220px]">
          <div className="overflow-hidden rounded-xl bg-slate-100">
            {cover
              ? (
                  <img
                    src={cover}
                    alt={detail.title || '小红书作品封面'}
                    className="h-52 w-full object-cover"
                  />
                )
              : (
                  <div className="flex h-52 items-center justify-center text-slate-400">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {detail.type === 'video' ? '视频' : '图文'}
              </span>
              {detail.ipLocation && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{detail.ipLocation}</span>}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">{detail.title || '未命名笔记'}</h2>
            <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{detail.description || '暂无正文描述。'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.topics.length > 0
                ? detail.topics.map(topic => (
                    <a
                      key={topic.name}
                      className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                      href={topic.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {topic.name}
                    </a>
                  ))
                : <span className="text-sm text-slate-400">暂无话题</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                发布时间：
                {formatTimestamp(detail.publishTime)}
              </span>
              <span className="inline-flex items-center gap-1">
                <ImageIcon className="h-4 w-4" />
                素材：
                {detail.type === 'video' ? '视频' : `${detail.imageList.length || 1} 张图片`}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
            <div className="flex items-center gap-3">
              {detail.author.avatar
                ? <img src={detail.author.avatar} alt={detail.author.name || '作者头像'} className="h-12 w-12 rounded-full object-cover" />
                : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400"><UserRound className="h-6 w-6" /></div>}
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-950">{detail.author.name || '未知作者'}</div>
                {detail.author.url && (
                  <a className="text-xs text-sky-600 hover:text-sky-700" href={detail.author.url} target="_blank" rel="noreferrer">
                    打开主页
                  </a>
                )}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-white p-3">
                <div className="text-lg font-semibold text-slate-950">{compactMetric(estimatedRead)}</div>
                <div className="mt-1 text-xs text-slate-500">预估阅读</div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-lg font-semibold text-slate-950">{compactMetric(engagement)}</div>
                <div className="mt-1 text-xs text-slate-500">互动量</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="预估曝光阅读" value={compactMetric(estimatedRead)} icon={<Eye className="h-5 w-5" />} />
        <MetricCard label="点赞" value={compactMetric(detail.interactInfo.likeCount)} icon={<Heart className="h-5 w-5" />} />
        <MetricCard label="收藏" value={compactMetric(detail.interactInfo.collectCount)} icon={<Star className="h-5 w-5" />} />
        <MetricCard label="评论" value={compactMetric(detail.interactInfo.commentCount)} icon={<MessageSquareText className="h-5 w-5" />} />
        <MetricCard label="分享" value={compactMetric(detail.interactInfo.shareCount)} icon={<Share2 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <MiniTrend detail={detail} />
        <section className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-950">相关评论 TOP 5</h3>
          <p className="mt-1 text-sm text-slate-500">按点赞和回复数排序，辅助判断评论方向。</p>
          <div className="mt-4 space-y-3">
            {topComments.length > 0
              ? topComments.map(comment => (
                  <div key={comment.id || `${comment.user.id}-${comment.content}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="truncate font-medium text-slate-700">{comment.user.nickname || comment.user.id || '未知用户'}</span>
                      <span>
                        {comment.likeCount}
                        {' '}
                        likes ·
                        {' '}
                        {comment.replyCount}
                        {' '}
                        replies
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-700">{comment.content || '空评论'}</p>
                  </div>
                ))
              : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">暂未抓取到评论</div>}
          </div>
        </section>
      </div>
    </div>
  )
}

export default function XhsDataPage() {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null)
  const [noteUrl, setNoteUrl] = useState('')
  const [detail, setDetail] = useState<WorkDetail | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [monitorMessage, setMonitorMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const parsedNote = useMemo(() => parseXhsNoteUrl(noteUrl), [noteUrl])

  useEffect(() => {
    let mounted = true
    getXhsBridgeStatus().then((status) => {
      if (mounted) {
        setBridgeStatus(status)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  async function monitorWork() {
    if (!parsedNote.workId) {
      setMonitorMessage('请填写有效的小红书作品链接或作品 ID。')
      return
    }

    if (!parsedNote.xsecToken) {
      setMonitorMessage('作品监测需要链接中带 xsec_token。请从小红书网页复制完整作品链接后重试。')
      return
    }

    setLoading(true)
    setMonitorMessage('')
    const res = await getWorkMonitorViaAutoclawBridge({
      workId: parsedNote.workId,
      xsecToken: parsedNote.xsecToken,
      xsecSource: parsedNote.xsecSource,
    })
    setLoading(false)

    if (!res.success || !res.detail) {
      setDetail(null)
      setComments([])
      setMonitorMessage(res.message || '作品监测失败，请确认插件已连接并已登录小红书。')
      return
    }

    setDetail(res.detail)
    setComments(res.comments)
    setMonitorMessage(`已完成本次快照抓取：${res.comments.length} 条评论。`)
  }

  return (
    <div className="min-h-full bg-[#f6fbff] px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">小红书数据</h1>
          <p className="mt-1 text-sm text-slate-600">通过浏览器插件获取小红书作品、互动和评论数据。</p>
        </header>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <section className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
            <Chrome className="h-6 w-6 text-sky-500" />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">插件状态</h2>
            <p className="mt-2 text-sm text-slate-600">
              {bridgeStatus?.ready ? 'XHS Bridge 已就绪，可以抓取作品详情和评论。' : bridgeStatus?.message || XHS_CAPTURE_SETUP_MESSAGE}
            </p>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <div>
                Bridge 服务：
                {bridgeStatus?.serverRunning ? '已启动' : '未连接'}
              </div>
              <div>
                Chrome 扩展：
                {bridgeStatus?.extensionConnected ? '已连接' : '未连接'}
              </div>
              <div>
                旧版 AiToEarn 插件：
                {bridgeStatus?.legacyPluginAvailable ? '可用' : '不可用'}
              </div>
            </div>
            <Link className="mt-4 inline-flex text-sm font-medium text-sky-600 hover:text-sky-700" href="./websit/plugin-guide">
              查看插件配置
            </Link>
          </section>
          <section className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
            <BarChart3 className="h-6 w-6 text-sky-500" />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">作品监测</h2>
            <p className="mt-2 text-sm text-slate-600">输入作品链接后抓取封面、作者、互动指标、话题和评论快照。</p>
            <a className="mt-4 inline-flex text-sm font-medium text-sky-600 hover:text-sky-700" href="#work-monitor">
              开始监测
            </a>
          </section>
          <section className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
            <MessageSquareText className="h-6 w-6 text-sky-500" />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">评论检索</h2>
            <p className="mt-2 text-sm text-slate-600">按作品链接拉取评论并支持关键词筛选。</p>
            <Link className="mt-4 inline-flex text-sm font-medium text-sky-600 hover:text-sky-700" href="./note-comment-search">
              进入评论检索
            </Link>
          </section>
        </div>

        <section id="work-monitor" className="mt-5 rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="xhs-note-url">作品链接</label>
              <input
                id="xhs-note-url"
                className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="https://www.xiaohongshu.com/explore/..."
                value={noteUrl}
                onChange={event => setNoteUrl(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-sky-500 px-4 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
              disabled={loading}
              onClick={monitorWork}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? '监测中' : '监测作品'}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            本地版使用浏览器插件读取当前登录小红书页面，完整链接中的
            <code className="mx-1 rounded bg-sky-50 px-1 py-0.5 text-sky-700">xsec_token</code>
            会用于打开作品详情。
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            {['封面与正文', '作者信息', '预估曝光阅读', '点赞/收藏/评论/分享', '相关评论 TOP'].map(item => (
              <span key={item} className="rounded-full bg-slate-50 px-3 py-1">
                {item}
              </span>
            ))}
          </div>
          {monitorMessage && (
            <div className="mt-4 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-600">
              {monitorMessage}
            </div>
          )}
        </section>

        {detail && <WorkMonitorResult detail={detail} comments={comments} />}
      </div>
    </div>
  )
}
