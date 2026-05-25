'use client'

import type { PromotionTask } from '@/api/types/promotion'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiCreateAdvertiserPromotionTask, apiListAdvertiserPromotionTasks } from '@/api/promotion'
import { Button } from '@/components/ui/button'
import { notification } from '@/lib/notification'
import { TaskCard } from '../../task-square/components/TaskCard'

const defaultTaskForm: Partial<PromotionTask> = {
  title: '',
  description: '',
  platform: 'xhs',
  settlementType: 'fixed',
  rewardAmount: 0,
  cpmRewardPerThousand: 0,
  cpeRewardPerThousand: 0,
  capAmount: 0,
  followerLimit: 0,
  quotaTotal: 0,
  tags: [],
  status: 'published',
  oneClickPostEnabled: false,
}

export default function AdvertiserTasksPage() {
  const [tasks, setTasks] = useState<PromotionTask[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<PromotionTask>>(defaultTaskForm)

  useEffect(() => {
    setLoading(true)
    apiListAdvertiserPromotionTasks({ page: 1, pageSize: 30 })
      .then(res => setTasks(res?.data?.list ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function createTask() {
    if (!form.title || !form.platform || !form.settlementType) {
      notification.warning({ content: '请填写任务标题、平台和结算方式。' })
      return
    }
    setSaving(true)
    const res = await apiCreateAdvertiserPromotionTask({
      ...form,
      tags: typeof form.tags === 'string'
        ? String(form.tags).split(',').map(tag => tag.trim()).filter(Boolean)
        : form.tags,
    })
    setSaving(false)
    if (res?.code === 0 && res.data) {
      setTasks(prev => [res.data, ...prev])
      setForm(defaultTaskForm)
      setShowCreate(false)
      notification.success({ content: '任务已创建。' })
      return
    }
    notification.warning({ content: res?.message || '创建失败，请稍后再试。' })
  }

  function setField<K extends keyof PromotionTask>(key: K, value: PromotionTask[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-full bg-[#f6fbff] px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">营销任务管理</h1>
            <p className="mt-1 text-sm text-slate-600">创建、发布和审核品牌推广任务。</p>
          </div>
          <Button onClick={() => setShowCreate(value => !value)}>
            <Plus className="h-4 w-4" />
            新建任务
          </Button>
        </header>

        {showCreate && (
          <section className="mt-5 rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">新建推广任务</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="任务标题" value={form.title || ''} onChange={event => setField('title', event.target.value)} />
              <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="平台，如 xhs / douyin / kwai" value={form.platform || ''} onChange={event => setField('platform', event.target.value)} />
              <select className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={form.settlementType} onChange={event => setField('settlementType', event.target.value as PromotionTask['settlementType'])}>
                <option value="fixed">固定</option>
                <option value="cpm">CPM</option>
                <option value="cpe">CPE</option>
                <option value="interaction">互动</option>
              </select>
              <select className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={form.status} onChange={event => setField('status', event.target.value as PromotionTask['status'])}>
                <option value="draft">草稿</option>
                <option value="published">发布</option>
                <option value="paused">暂停</option>
                <option value="ended">结束</option>
              </select>
              <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="number" placeholder="固定奖励" value={form.rewardAmount ?? 0} onChange={event => setField('rewardAmount', Number(event.target.value))} />
              <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="number" placeholder="CPM 每千次奖励" value={form.cpmRewardPerThousand ?? 0} onChange={event => setField('cpmRewardPerThousand', Number(event.target.value))} />
              <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="number" placeholder="CPE 每千次奖励" value={form.cpeRewardPerThousand ?? 0} onChange={event => setField('cpeRewardPerThousand', Number(event.target.value))} />
              <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="number" placeholder="封顶金额" value={form.capAmount ?? 0} onChange={event => setField('capAmount', Number(event.target.value))} />
              <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="number" placeholder="粉丝门槛" value={form.followerLimit ?? 0} onChange={event => setField('followerLimit', Number(event.target.value))} />
              <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="number" placeholder="任务名额" value={form.quotaTotal ?? 0} onChange={event => setField('quotaTotal', Number(event.target.value))} />
              <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="标签，用英文逗号分隔" value={(form.tags ?? []).join(',')} onChange={event => setField('tags', event.target.value.split(',').map(tag => tag.trim()).filter(Boolean))} />
              <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm text-slate-700">
                <input type="checkbox" checked={!!form.oneClickPostEnabled} onChange={event => setField('oneClickPostEnabled', event.target.checked)} />
                支持一键发布
              </label>
              <textarea className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm md:col-span-2" placeholder="任务说明和内容要求" value={form.description || ''} onChange={event => setField('description', event.target.value)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button loading={saving} onClick={createTask}>保存任务</Button>
            </div>
          </section>
        )}

        <section className="mt-5 rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
          {loading && <div className="py-14 text-center text-sm text-slate-500">加载中...</div>}
          {!loading && tasks.length === 0 && (
            <div className="py-16 text-center">
              <p className="font-medium text-slate-900">暂无营销任务</p>
              <p className="mt-1 text-sm text-slate-500">后续可在这里创建任务、设置结算方式和审核提交。</p>
            </div>
          )}
          {!loading && tasks.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              {tasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
