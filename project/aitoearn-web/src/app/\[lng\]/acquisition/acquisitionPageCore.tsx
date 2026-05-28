'use client'

import { BarChart3, FileText, MessageSquareText, Target, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AcquisitionPageCore() {
  const { t } = useTranslation('route')

  const tabs = [
    { value: 'dashboard', label: t('acquisition.tabs.dashboard'), icon: BarChart3 },
    { value: 'content', label: t('acquisition.tabs.content'), icon: FileText },
    { value: 'hooks', label: t('acquisition.tabs.hooks'), icon: Target },
    { value: 'leads', label: t('acquisition.tabs.leads'), icon: MessageSquareText },
    { value: 'accounts', label: t('acquisition.tabs.accounts'), icon: UsersRound },
  ]

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">{t('header.acquisition')}</h1>
          <p className="text-sm text-muted-foreground">多平台服装 AI 获客工作台</p>
        </header>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:inline-grid lg:w-auto lg:grid-cols-5">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2 px-3 py-2">
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsContent key={tab.value} value={tab.value} className="mt-5">
                <section className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">{tab.label}</h2>
                      <p className="text-sm text-muted-foreground">Phase 0 路由骨架，后续阶段接入真实数据。</p>
                    </div>
                  </div>
                </section>
              </TabsContent>
            )
          })}
        </Tabs>
      </div>
    </main>
  )
}
