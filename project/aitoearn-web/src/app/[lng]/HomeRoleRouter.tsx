'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Megaphone, Sparkles, WalletCards } from 'lucide-react'

const DraftBoxCore = dynamic(() => import('./draft-box/DraftBoxCore'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-brand-cyan" />
    </div>
  ),
})

export default function HomeRoleRouter() {
  const searchParams = useSearchParams()
  const role = searchParams.get('role')

  if (role !== 'creator' && role !== 'advertiser') {
    return <DraftBoxCore />
  }

  const isCreator = role === 'creator'

  return (
    <div className="min-h-full bg-[#f6fbff] px-8 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-lg border border-sky-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-sky-600">{isCreator ? 'Creator' : 'Advertiser'}</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                {isCreator ? '任务广场' : '营销任务管理'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                {isCreator
                  ? '浏览可领取的品牌合作任务，连接频道后提交作品并跟踪收益。'
                  : '创建营销任务、审核创作者提交内容，并管理结算记录。'}
              </p>
            </div>
            <Link
              href={isCreator ? './task-square' : './advertiser/tasks'}
              className="inline-flex h-10 items-center justify-center rounded-md bg-sky-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
            >
              {isCreator ? '进入任务广场' : '管理推广任务'}
            </Link>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Link className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm hover:border-sky-300" href="./task-square">
            <Megaphone className="h-6 w-6 text-sky-500" />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">任务广场</h2>
            <p className="mt-2 text-sm text-slate-600">固定、CPM、CPE 和互动类任务统一入口。</p>
          </Link>
          <Link className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm hover:border-sky-300" href="./gold">
            <WalletCards className="h-6 w-6 text-sky-500" />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">金币中心</h2>
            <p className="mt-2 text-sm text-slate-600">查看待结算和可用收益流水。</p>
          </Link>
          <Link className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm hover:border-sky-300" href="./xhs-data">
            <Sparkles className="h-6 w-6 text-sky-500" />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">小红书数据</h2>
            <p className="mt-2 text-sm text-slate-600">接入浏览器插件后监测作品和评论数据。</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
