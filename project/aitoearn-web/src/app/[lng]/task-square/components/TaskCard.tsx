import type { PromotionTask } from '@/api/types/promotion'
import type { ReactNode } from 'react'
import { BadgeCheck, BarChart3, MousePointerClick, Users } from 'lucide-react'

const settlementLabel: Record<PromotionTask['settlementType'], string> = {
  fixed: '固定',
  cpm: 'CPM',
  cpe: 'CPE',
  interaction: '互动',
}

function formatReward(task: PromotionTask) {
  if (task.settlementType === 'cpm')
    return `¥${task.cpmRewardPerThousand ?? 0}/千次曝光`
  if (task.settlementType === 'cpe')
    return `¥${task.cpeRewardPerThousand ?? 0}/千次有效互动`
  return `¥${task.rewardAmount ?? 0}`
}

export function TaskCard({ task, action }: { task: PromotionTask, action?: ReactNode }) {
  const quotaText = task.quotaTotal
    ? `${task.quotaAccepted ?? 0}/${task.quotaTotal}`
    : '不限'

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-sky-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
              {settlementLabel[task.settlementType]}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {task.platform}
            </span>
            {task.oneClickPostEnabled && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                <BadgeCheck className="h-3 w-3" />
                一键发布
              </span>
            )}
          </div>
          <h3 className="mt-3 truncate text-base font-semibold text-slate-950">{task.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{task.description || '暂无任务说明'}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold text-sky-600">{formatReward(task)}</div>
          {task.capAmount ? <div className="mt-1 text-xs text-slate-500">封顶 ¥{task.capAmount}</div> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
          <Users className="h-4 w-4 text-slate-400" />
          粉丝 {task.followerLimit ? `${task.followerLimit}+` : '不限'}
        </div>
        <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          名额 {quotaText}
        </div>
        <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
          <MousePointerClick className="h-4 w-4 text-slate-400" />
          {task.isSoldOut ? '已抢完' : '可领取'}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(task.tags ?? []).slice(0, 4).map(tag => (
            <span key={tag} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500">
              #{tag}
            </span>
          ))}
        </div>
        {action}
      </div>
    </article>
  )
}
