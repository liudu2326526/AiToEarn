'use client'

import { BarChart3, FileText, MessageSquareText, Target, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommentCapabilityCards } from './components/CommentCapabilityCards'
import { WorkFetchPanel } from './components/WorkFetchPanel'
import { ContentManagementPanel } from './components/ContentManagementPanel'
import { StrategyManagementPanel } from './components/StrategyManagementPanel'

const tabs = [
  { value: 'dashboard', labelKey: 'acquisition.tabs.dashboard', icon: BarChart3 },
  { value: 'content', labelKey: 'acquisition.tabs.content', icon: FileText },
  { value: 'hooks', labelKey: 'acquisition.tabs.hooks', icon: Target },
  { value: 'leads', labelKey: 'acquisition.tabs.leads', icon: MessageSquareText },
  { value: 'accounts', labelKey: 'acquisition.tabs.accounts', icon: UsersRound },
]

export function AcquisitionPageCore() {
  const { t } = useTranslation('route')

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">{t('header.acquisition')}</h1>
          <p className="text-sm text-muted-foreground">{t('acquisition.subtitle')}</p>
        </header>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:inline-grid lg:w-auto lg:grid-cols-5">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2 px-3 py-2">
                  <Icon size={16} />
                  <span>{t(tab.labelKey)}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {tabs.map((tab) => {
            const Icon = tab.icon
            const label = t(tab.labelKey)

            function renderTabContent(value: string) {
              if (value === 'dashboard') {
                return (
                  <div className="grid gap-4">
                    <CommentCapabilityCards />
                    <WorkFetchPanel />
                  </div>
                )
              }
              if (value === 'content') {
                return <ContentManagementPanel />
              }
              if (value === 'hooks') {
                return <StrategyManagementPanel />
              }
              return (
                <section className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">{label}</h2>
                      <p className="text-sm text-muted-foreground">{t('acquisition.placeholder')}</p>
                    </div>
                  </div>
                </section>
              )
            }

            return (
              <TabsContent key={tab.value} value={tab.value} className="mt-5">
                {renderTabContent(tab.value)}
              </TabsContent>
            )
          })}
        </Tabs>
      </div>
    </main>
  )
}
