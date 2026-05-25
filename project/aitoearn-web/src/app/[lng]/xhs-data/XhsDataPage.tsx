'use client'

import Link from 'next/link'
import { BarChart3, Chrome, MessageSquareText } from 'lucide-react'
import { XHS_CAPTURE_SETUP_MESSAGE } from '@/store/plugin/plats/xhs/autoclawBridge'

export default function XhsDataPage() {
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
            <p className="mt-2 text-sm text-slate-600">{XHS_CAPTURE_SETUP_MESSAGE}</p>
            <Link className="mt-4 inline-flex text-sm font-medium text-sky-600 hover:text-sky-700" href="./websit/plugin-guide">
              查看插件配置
            </Link>
          </section>
          <section className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
            <BarChart3 className="h-6 w-6 text-sky-500" />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">作品监测</h2>
            <p className="mt-2 text-sm text-slate-600">后续展示作品阅读、点赞、收藏和评论趋势。</p>
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
      </div>
    </div>
  )
}
