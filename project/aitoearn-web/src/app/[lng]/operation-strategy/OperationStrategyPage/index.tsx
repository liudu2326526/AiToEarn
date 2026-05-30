'use client'

import { Card, Space, Tabs, Typography } from 'antd'
import { BarChart3, MessageSquareText, ShieldCheck } from 'lucide-react'
import { useTransClient } from '@/app/i18n/client'
import AccountOpsConfigManager from '../components/AccountOpsConfigManager'
import HookTemplateManager from '../components/HookTemplateManager'
import ScriptTemplateManager from '../components/ScriptTemplateManager'

const { Text, Title } = Typography

export default function OperationStrategyPage() {
  const { t } = useTransClient('route')

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,#f6f8fb_0,#fff_360px)] px-4 py-5 md:px-8 md:py-7">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="rounded-xl border border-border/70 bg-background/95 p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('operationStrategy.eyebrow')}
              </div>
              <Title level={2} style={{ margin: '12px 0 0', lineHeight: 1.2 }}>
                {t('operationStrategy.title')}
              </Title>
              <Text type="secondary" style={{ display: 'block', maxWidth: 760, lineHeight: 1.7 }}>
                {t('operationStrategy.subtitle')}
              </Text>
            </div>
            <Space size={10} wrap>
              <span className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                {t('operationStrategy.summary.iteration')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                <MessageSquareText className="h-4 w-4" />
                {t('operationStrategy.summary.reuse')}
              </span>
            </Space>
          </div>
        </div>

        <Card
          style={{ borderRadius: 8, borderColor: '#e8edf5' }}
          styles={{ body: { padding: 16 } }}
        >
          <Tabs
            destroyInactiveTabPane={false}
            items={[
              { key: 'hooks', label: t('operationStrategy.tabs.hooks'), children: <HookTemplateManager /> },
              { key: 'scripts', label: t('operationStrategy.tabs.scripts'), children: <ScriptTemplateManager /> },
              { key: 'accounts', label: t('operationStrategy.tabs.accounts'), children: <AccountOpsConfigManager /> },
            ]}
          />
        </Card>
      </section>
    </main>
  )
}
