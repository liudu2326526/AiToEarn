'use client'

import type { PromotionSettlementType, PromotionTask } from '@/api/types/promotion'
import { AlertCircle, Coins, Filter, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiAcceptPromotionTask, apiListPromotionTasks } from '@/api/promotion'
import { Button } from '@/components/ui/button'
import { notification } from '@/lib/notification'
import { TaskCard } from './components/TaskCard'

const settlementOptions: Array<{ value: PromotionSettlementType | '', label: string }> = [
  { value: '', label: '全部' },
  { value: 'fixed', label: '固定' },
  { value: 'cpm', label: 'CPM' },
  { value: 'cpe', label: 'CPE' },
  { value: 'interaction', label: '互动' },
]

export default function TaskSquarePage() {
  const [keyword, setKeyword] = useState('')
  const [settlementType, setSettlementType] = useState<PromotionSettlementType | ''>('')
  const [tasks, setTasks] = useState<PromotionTask[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string>()

  const queryParams = useMemo(() => ({
    page: 1,
    pageSize: 30,
    keyword: keyword || undefined,
    settlementType: settlementType || undefined,
  }), [keyword, settlementType])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    apiListPromotionTasks(queryParams)
      .then((res) => {
        if (!mounted)
          return
        setTasks(res?.data?.list ?? [])
        setTotal(res?.data?.total ?? 0)
      })
      .finally(() => {
        if (mounted)
          setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [queryParams])

  async function handleAccept(task: PromotionTask) {
    setAcceptingId(task.id)
    const res = await apiAcceptPromotionTask(task.id, {})
    setAcceptingId(undefined)
    if (res?.code === 0) {
      notification.success({ content: '已领取任务，请在我的任务中提交作品。' })
      return
    }
    notification.warning({ content: res?.message || '领取失败，请稍后再试。' })
  }

  return (
    <div className="min-h-full bg-[#f6fbff] px-6 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-sky-100 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              <Coins className="h-4 w-4" />
              Gold Rush
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">任务广场</h1>
            <p className="mt-1 text-sm text-slate-600">领取品牌推广任务，发布作品后提交链接等待审核结算。</p>
          </div>
          <a href="./accounts" className="text-sm font-medium text-sky-600 hover:text-sky-700">
            先连接发布频道
          </a>
        </header>

        <section className="flex flex-col gap-3 rounded-lg border border-sky-100 bg-white p-4 shadow-sm md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              placeholder="搜索任务标题、品牌或要求"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {settlementOptions.map(option => (
              <button
                key={option.value || 'all'}
                type="button"
                className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm ${
                  settlementType === option.value
                    ? 'border-sky-300 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200'
                }`}
                onClick={() => setSettlementType(option.value)}
              >
                <Filter className="h-4 w-4" />
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">可领取任务</h2>
            <span className="text-sm text-slate-500">{total} 个任务</span>
          </div>
          {loading && <div className="py-14 text-center text-sm text-slate-500">加载中...</div>}
          {!loading && tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <AlertCircle className="h-8 w-8 text-sky-400" />
              <div>
                <p className="font-medium text-slate-900">暂无可领取任务</p>
                <p className="mt-1 text-sm text-slate-500">可以先连接频道，稍后刷新任务广场。</p>
              </div>
            </div>
          )}
          {!loading && tasks.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  action={(
                    <Button
                      size="sm"
                      loading={acceptingId === task.id}
                      disabled={task.isSoldOut}
                      onClick={() => handleAccept(task)}
                    >
                      {task.isSoldOut ? '已抢完' : '领取任务'}
                    </Button>
                  )}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
