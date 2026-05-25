'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { getCommentList } from '@/store/plugin/plats/xhs/comment'
import { getXhsCaptureSetupMessage } from '@/store/plugin/plats/xhs/xhsBridge'
import type { CommentItem } from '@/store/plugin/plats/types'
import { filterCommentsByKeyword } from './filterComments'

function parseXhsNoteUrl(input: string) {
  const trimmed = input.trim()
  const idMatch = trimmed.match(/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/) || trimmed.match(/^([a-zA-Z0-9]{16,})$/)
  const tokenMatch = trimmed.match(/[?&]xsec_token=([^&]+)/)
  return {
    workId: idMatch?.[1] ?? '',
    xsecToken: tokenMatch?.[1] ? decodeURIComponent(tokenMatch[1]) : '',
  }
}

export default function NoteCommentSearchPage() {
  const [noteUrl, setNoteUrl] = useState('')
  const [keyword, setKeyword] = useState('')
  const [allComments, setAllComments] = useState<CommentItem[]>([])
  const [message, setMessage] = useState(getXhsCaptureSetupMessage())
  const [loading, setLoading] = useState(false)
  const comments = useMemo(() => filterCommentsByKeyword(allComments, keyword), [allComments, keyword])

  async function searchComments() {
    const { workId, xsecToken } = parseXhsNoteUrl(noteUrl)
    if (!workId) {
      setMessage('请填写有效的小红书作品链接或作品 ID。')
      return
    }
    setLoading(true)
    const res = await getCommentList({ workId, xsecToken })
    setLoading(false)
    if (!res.success) {
      setAllComments([])
      setMessage(res.message || getXhsCaptureSetupMessage())
      return
    }
    setAllComments(res.comments)
    setMessage(res.comments.length ? '' : '未抓取到评论。')
  }

  const emptyMessage = allComments.length > 0 && comments.length === 0
    ? '未匹配到评论。'
    : message

  return (
    <div className="min-h-full bg-[#f6fbff] px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">小红书评论检索</h1>
          <p className="mt-1 text-sm text-slate-600">输入作品链接，插件授权后可抓取评论并做关键词筛选。</p>
        </header>

        <section className="mt-5 rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
          <label className="text-sm font-medium text-slate-700" htmlFor="noteUrl">作品链接</label>
          <div className="mt-2 flex gap-2">
            <input
              id="noteUrl"
              className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              placeholder="https://www.xiaohongshu.com/explore/..."
              value={noteUrl}
              onChange={event => setNoteUrl(event.target.value)}
            />
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-500 px-4 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
              disabled={!noteUrl.trim() || loading}
              onClick={searchComments}
            >
              <Search className="h-4 w-4" />
              {loading ? '检索中' : '检索'}
            </button>
          </div>
          <input
            className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            placeholder="关键词，可选"
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
          />
          <div className="mt-8 rounded-lg border border-dashed border-sky-200 bg-sky-50/60 p-6 text-sm text-slate-600">
            {comments.length === 0 && <div className="text-center">{emptyMessage}</div>}
            {comments.length > 0 && (
              <div className="divide-y divide-sky-100 rounded-md bg-white">
                {comments.map(comment => (
                  <div key={comment.id} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-900">{comment.user.nickname || comment.user.id || 'Unknown'}</span>
                      <span className="text-xs text-slate-500">
                        {comment.likeCount}
                        {' '}
                        likes ·
                        {' '}
                        {comment.replyCount}
                        {' '}
                        replies
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap leading-6">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
