'use client'

import { CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react'

const platforms = [
  {
    platform: 'xhs',
    name: '小红书',
    status: 'bridge_required',
    description: '插件/Bridge',
    icon: CircleAlert,
  },
  {
    platform: 'douyin',
    name: '抖音',
    status: 'scope_required',
    description: 'item.comment scope',
    icon: CircleAlert,
  },
  {
    platform: 'kwai',
    name: '快手',
    status: 'pending_confirmation',
    description: '待确认',
    icon: CircleDashed,
  },
]

export function CommentCapabilityCards() {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {platforms.map((item) => {
        const Icon = item.status === 'ready' ? CheckCircle2 : item.icon
        return (
          <article key={item.platform} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{item.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Icon size={20} className="text-muted-foreground" />
            </div>
          </article>
        )
      })}
    </section>
  )
}
