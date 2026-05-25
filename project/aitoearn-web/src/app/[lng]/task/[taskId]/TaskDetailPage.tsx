'use client'

import type { PromotionTask } from '@/api/types/promotion'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiAcceptPromotionTask, apiGetPromotionTask, apiSubmitPromotionWork } from '@/api/promotion'
import { Button } from '@/components/ui/button'
import { notification } from '@/lib/notification'
import { TaskCard } from '../../task-square/components/TaskCard'

export default function TaskDetailPage({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<PromotionTask>()
  const [loading, setLoading] = useState(true)
  const [applicationId, setApplicationId] = useState<string>()
  const [workLink, setWorkLink] = useState('')
  const [publishRecordId, setPublishRecordId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiGetPromotionTask(taskId)
      .then(res => setTask(res?.data))
      .finally(() => setLoading(false))
  }, [taskId])

  async function acceptTask() {
    setSubmitting(true)
    const res = await apiAcceptPromotionTask(taskId, {})
    setSubmitting(false)
    if (res?.code === 0 && res.data?.id) {
      setApplicationId(res.data.id)
      notification.success({ content: '任务已领取，可以提交作品链接。' })
      return
    }
    notification.warning({ content: res?.message || '领取失败，请稍后再试。' })
  }

  async function submitWork() {
    if (!applicationId || !workLink.trim())
      return
    setSubmitting(true)
    const res = await apiSubmitPromotionWork(applicationId, {
      workLink: workLink.trim(),
      publishRecordId: publishRecordId.trim() || undefined,
    })
    setSubmitting(false)
    if (res?.code === 0) {
      notification.success({ content: '已提交审核，审核通过后将进入金币结算。' })
      return
    }
    notification.warning({ content: res?.message || '提交失败，请稍后再试。' })
  }

  return (
    <div className="min-h-full bg-[#f6fbff] px-6 py-6">
      <div className="mx-auto max-w-4xl">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700" href="../../task-square">
          <ArrowLeft className="h-4 w-4" />
          返回任务广场
        </Link>
        <section className="mt-5 rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
          {loading && <div className="py-14 text-center text-sm text-slate-500">加载中...</div>}
          {!loading && !task && <div className="py-14 text-center text-sm text-slate-500">任务不存在或已下架</div>}
          {task && (
            <div className="flex flex-col gap-5">
              <TaskCard task={task} />
              <section className="rounded-lg border border-sky-100 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">提交作品</h2>
                    <p className="mt-1 text-sm text-slate-600">支持手动作品链接，也可以填写一键发布返回的 publishRecordId。</p>
                  </div>
                  {!applicationId && (
                    <Button loading={submitting} disabled={task.isSoldOut} onClick={acceptTask}>
                      {task.isSoldOut ? '任务已抢完' : '先领取任务'}
                    </Button>
                  )}
                </div>

                {applicationId && (
                  <div className="mt-4 grid gap-3">
                    <input
                      className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                      placeholder="作品链接，如 https://www.xiaohongshu.com/explore/..."
                      value={workLink}
                      onChange={event => setWorkLink(event.target.value)}
                    />
                    <input
                      className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                      placeholder="publishRecordId，可选"
                      value={publishRecordId}
                      onChange={event => setPublishRecordId(event.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button loading={submitting} disabled={!workLink.trim()} onClick={submitWork}>
                        提交审核
                      </Button>
                    </div>
                  </div>
                )}
              </section>
              <div className="rounded-lg bg-sky-50 p-4 text-sm leading-6 text-slate-700">
                领取任务前请确认已连接对应发布频道。发布作品后回到任务记录提交作品链接，广告主审核通过后进入金币结算。
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
