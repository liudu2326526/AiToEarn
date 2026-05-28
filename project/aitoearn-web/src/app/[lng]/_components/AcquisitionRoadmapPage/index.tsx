'use client'

import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Database,
  Gauge,
  Inbox,
  Link2,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

type RoadmapPageType = 'workData' | 'leads' | 'strategy' | 'dashboard'

interface RoadmapFeature {
  icon: LucideIcon
  titleKey: string
  descriptionKey: string
}

interface RoadmapPageConfig {
  titleKey: string
  subtitleKey: string
  eyebrowKey: string
  icon: LucideIcon
  features: RoadmapFeature[]
  flow: string[]
}

const pageConfigs: Record<RoadmapPageType, RoadmapPageConfig> = {
  workData: {
    titleKey: 'acquisition.pages.workData.title',
    subtitleKey: 'acquisition.pages.workData.subtitle',
    eyebrowKey: 'acquisition.pages.workData.eyebrow',
    icon: Database,
    flow: [
      'acquisition.pages.workData.flow.input',
      'acquisition.pages.workData.flow.fetch',
      'acquisition.pages.workData.flow.snapshot',
      'acquisition.pages.workData.flow.sync',
    ],
    features: [
      {
        icon: ClipboardList,
        titleKey: 'acquisition.pages.workData.features.monitor.title',
        descriptionKey: 'acquisition.pages.workData.features.monitor.description',
      },
      {
        icon: Link2,
        titleKey: 'acquisition.pages.workData.features.fetch.title',
        descriptionKey: 'acquisition.pages.workData.features.fetch.description',
      },
      {
        icon: BarChart3,
        titleKey: 'acquisition.pages.workData.features.results.title',
        descriptionKey: 'acquisition.pages.workData.features.results.description',
      },
      {
        icon: MessageSquareText,
        titleKey: 'acquisition.pages.workData.features.comments.title',
        descriptionKey: 'acquisition.pages.workData.features.comments.description',
      },
      {
        icon: ShieldCheck,
        titleKey: 'acquisition.pages.workData.features.source.title',
        descriptionKey: 'acquisition.pages.workData.features.source.description',
      },
      {
        icon: RefreshCw,
        titleKey: 'acquisition.pages.workData.features.batch.title',
        descriptionKey: 'acquisition.pages.workData.features.batch.description',
      },
    ],
  },
  leads: {
    titleKey: 'acquisition.pages.leads.title',
    subtitleKey: 'acquisition.pages.leads.subtitle',
    eyebrowKey: 'acquisition.pages.leads.eyebrow',
    icon: MessageSquareText,
    flow: [
      'acquisition.pages.leads.flow.detect',
      'acquisition.pages.leads.flow.assign',
      'acquisition.pages.leads.flow.reply',
      'acquisition.pages.leads.flow.convert',
    ],
    features: [
      {
        icon: Search,
        titleKey: 'acquisition.pages.leads.features.list.title',
        descriptionKey: 'acquisition.pages.leads.features.list.description',
      },
      {
        icon: Inbox,
        titleKey: 'acquisition.pages.leads.features.messages.title',
        descriptionKey: 'acquisition.pages.leads.features.messages.description',
      },
      {
        icon: Bot,
        titleKey: 'acquisition.pages.leads.features.reply.title',
        descriptionKey: 'acquisition.pages.leads.features.reply.description',
      },
      {
        icon: UserCheck,
        titleKey: 'acquisition.pages.leads.features.assign.title',
        descriptionKey: 'acquisition.pages.leads.features.assign.description',
      },
      {
        icon: ClipboardList,
        titleKey: 'acquisition.pages.leads.features.timeline.title',
        descriptionKey: 'acquisition.pages.leads.features.timeline.description',
      },
    ],
  },
  strategy: {
    titleKey: 'acquisition.pages.strategy.title',
    subtitleKey: 'acquisition.pages.strategy.subtitle',
    eyebrowKey: 'acquisition.pages.strategy.eyebrow',
    icon: SlidersHorizontal,
    flow: [
      'acquisition.pages.strategy.flow.hooks',
      'acquisition.pages.strategy.flow.scripts',
      'acquisition.pages.strategy.flow.rules',
      'acquisition.pages.strategy.flow.optimize',
    ],
    features: [
      {
        icon: ClipboardList,
        titleKey: 'acquisition.pages.strategy.features.hooks.title',
        descriptionKey: 'acquisition.pages.strategy.features.hooks.description',
      },
      {
        icon: MessageSquareText,
        titleKey: 'acquisition.pages.strategy.features.scripts.title',
        descriptionKey: 'acquisition.pages.strategy.features.scripts.description',
      },
      {
        icon: AlertCircle,
        titleKey: 'acquisition.pages.strategy.features.risk.title',
        descriptionKey: 'acquisition.pages.strategy.features.risk.description',
      },
      {
        icon: UsersRound,
        titleKey: 'acquisition.pages.strategy.features.accounts.title',
        descriptionKey: 'acquisition.pages.strategy.features.accounts.description',
      },
    ],
  },
  dashboard: {
    titleKey: 'acquisition.pages.dashboard.title',
    subtitleKey: 'acquisition.pages.dashboard.subtitle',
    eyebrowKey: 'acquisition.pages.dashboard.eyebrow',
    icon: BarChart3,
    flow: [
      'acquisition.pages.dashboard.flow.collect',
      'acquisition.pages.dashboard.flow.funnel',
      'acquisition.pages.dashboard.flow.rank',
      'acquisition.pages.dashboard.flow.improve',
    ],
    features: [
      {
        icon: Gauge,
        titleKey: 'acquisition.pages.dashboard.features.metrics.title',
        descriptionKey: 'acquisition.pages.dashboard.features.metrics.description',
      },
      {
        icon: BarChart3,
        titleKey: 'acquisition.pages.dashboard.features.funnel.title',
        descriptionKey: 'acquisition.pages.dashboard.features.funnel.description',
      },
      {
        icon: CalendarClock,
        titleKey: 'acquisition.pages.dashboard.features.trend.title',
        descriptionKey: 'acquisition.pages.dashboard.features.trend.description',
      },
      {
        icon: CheckCircle2,
        titleKey: 'acquisition.pages.dashboard.features.strategy.title',
        descriptionKey: 'acquisition.pages.dashboard.features.strategy.description',
      },
    ],
  },
}

export function AcquisitionRoadmapPage({ type }: { type: RoadmapPageType }) {
  const { t } = useTranslation('route')
  const config = pageConfigs[type]
  const PageIcon = config.icon

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-border pb-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <PageIcon size={14} />
            {t(config.eyebrowKey)}
          </div>
          <div className="max-w-3xl space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">{t(config.titleKey)}</h1>
            <p className="text-sm leading-6 text-muted-foreground">{t(config.subtitleKey)}</p>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          {config.flow.map((itemKey, index) => (
            <div key={itemKey} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{t(itemKey)}</span>
              {index < config.flow.length - 1 && <ArrowRight className="hidden size-4 text-muted-foreground md:block" />}
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {config.features.map((feature) => {
            const FeatureIcon = feature.icon
            return (
              <article key={feature.titleKey} className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-muted text-foreground">
                  <FeatureIcon size={20} />
                </div>
                <h2 className="text-base font-semibold text-foreground">{t(feature.titleKey)}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(feature.descriptionKey)}</p>
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
