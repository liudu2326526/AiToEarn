'use client'

import { CheckCircle2, Layers3, PlugZap, UsersRound } from 'lucide-react'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTransClient } from '@/app/i18n/client'
import { AuthLoadingPage } from '@/components/ChannelManager/components/AuthLoadingPage'
import { ConnectChannelList } from '@/components/ChannelManager/components/ConnectChannelList'
import { MainPage } from '@/components/ChannelManager/components/MainPage'
import { useChannelManagerStore } from '@/components/ChannelManager/channelManagerStore'
import { useAccountStore } from '@/store/account'
import { PLUGIN_SUPPORTED_PLATFORMS } from '@/store/plugin'

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  hint: string
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/85 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
    </div>
  )
}

export default function AccountManagementPage() {
  const { t } = useTransClient('route')
  const { t: accountT } = useTransClient('account')

  const { currentView } = useChannelManagerStore(
    useShallow(state => ({
      currentView: state.currentView,
    })),
  )

  const { accountList, accountGroupList } = useAccountStore(
    useShallow(state => ({
      accountList: state.accountList,
      accountGroupList: state.accountGroupList,
    })),
  )

  const platformCount = useMemo(() => {
    return new Set(accountList.map(account => account.type)).size
  }, [accountList])

  const pluginAccountCount = useMemo(() => {
    const pluginPlatforms = PLUGIN_SUPPORTED_PLATFORMS as readonly string[]
    return accountList.filter(account => pluginPlatforms.includes(account.type)).length
  }, [accountList])

  const pageContent = (() => {
    switch (currentView) {
      case 'connect-list':
        return <ConnectChannelList />
      case 'auth-loading':
        return <AuthLoadingPage />
      default:
        return <MainPage />
    }
  })()

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--muted)/0.42),transparent_260px)] px-4 py-5 md:px-8 md:py-7">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="rounded-xl border border-border/70 bg-background/95 p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <UsersRound className="h-3.5 w-3.5" />
                {t('accountManagement')}
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {t('accountManagement')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {t('accountManagement.subtitle')}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground md:max-w-sm">
              {t('accountManagement.tip')}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard
            icon={<UsersRound className="h-5 w-5" />}
            label={t('accountManagement.metrics.accounts')}
            value={accountList.length}
            hint={accountT('channelManager.channelCount', { count: accountList.length })}
          />
          <MetricCard
            icon={<Layers3 className="h-5 w-5" />}
            label={t('accountManagement.metrics.spaces')}
            value={accountGroupList.length}
            hint={t('accountManagement.metrics.spacesHint')}
          />
          <MetricCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label={t('accountManagement.metrics.platforms')}
            value={platformCount}
            hint={t('accountManagement.metrics.platformsHint')}
          />
          <MetricCard
            icon={<PlugZap className="h-5 w-5" />}
            label={t('accountManagement.metrics.plugin')}
            value={pluginAccountCount}
            hint={t('accountManagement.metrics.pluginHint')}
          />
        </div>

        <div className="min-h-[620px] overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
          {pageContent}
        </div>
      </section>
    </main>
  )
}
