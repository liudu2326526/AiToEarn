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
    <main className="operation-strategy-shell min-h-full bg-[linear-gradient(180deg,#f6f8fb_0,#fff_360px)] px-4 py-5 md:px-8 md:py-7">
      <style>
        {`
          .operation-strategy-shell .ant-btn {
            border-radius: 999px;
            border-color: rgba(216, 225, 236, 0.86);
            background: rgba(248, 250, 252, 0.72);
            color: #334155;
            box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
            font-weight: 600;
            backdrop-filter: blur(12px);
          }

          .operation-strategy-shell .ant-btn:not(:disabled):hover {
            border-color: rgba(155, 215, 255, 0.9);
            background: rgba(239, 248, 255, 0.88);
            color: #1677ff;
          }

          .operation-strategy-shell .ant-btn-primary {
            border-color: rgba(155, 215, 255, 0.92);
            background: rgba(239, 248, 255, 0.92);
            color: #1677ff;
            box-shadow: 0 8px 18px rgba(22, 119, 255, 0.12);
          }

          .operation-strategy-shell .ant-btn-primary:not(:disabled):hover {
            border-color: rgba(84, 175, 255, 0.92);
            background: rgba(224, 242, 254, 0.96);
            color: #0958d9;
          }

          .operation-strategy-shell .ant-btn-dangerous {
            border-color: rgba(255, 171, 171, 0.85);
            background: rgba(255, 241, 240, 0.82);
            color: #cf1322;
          }

          .operation-strategy-shell .ant-btn-dangerous:not(:disabled):hover {
            border-color: rgba(255, 120, 117, 0.9);
            background: rgba(255, 241, 240, 0.96);
            color: #a8071a;
          }

          .operation-strategy-shell .ant-switch {
            min-width: 44px;
            height: 24px;
            border: 1px solid rgba(216, 225, 236, 0.9);
            background: rgba(148, 163, 184, 0.18);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.34), 0 6px 14px rgba(15, 23, 42, 0.04);
            backdrop-filter: blur(12px);
          }

          .operation-strategy-shell .ant-switch:hover:not(.ant-switch-disabled) {
            background: rgba(148, 163, 184, 0.25);
          }

          .operation-strategy-shell .ant-switch.ant-switch-checked {
            border-color: rgba(155, 215, 255, 0.92);
            background: rgba(22, 119, 255, 0.58);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3), 0 8px 18px rgba(22, 119, 255, 0.12);
          }

          .operation-strategy-shell .ant-switch.ant-switch-checked:hover:not(.ant-switch-disabled) {
            background: rgba(22, 119, 255, 0.68);
          }

          .operation-strategy-shell .ant-switch .ant-switch-handle {
            top: 2px;
            width: 18px;
            height: 18px;
          }

          .operation-strategy-shell .ant-switch .ant-switch-handle::before {
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 3px 8px rgba(15, 23, 42, 0.14);
          }

          .operation-strategy-shell .ant-switch.ant-switch-checked .ant-switch-handle {
            inset-inline-start: calc(100% - 20px);
          }

          .operation-strategy-shell .ant-switch-inner {
            display: none;
          }

          .operation-strategy-shell .ant-tabs-nav {
            margin: 0 0 16px;
          }

          .operation-strategy-shell .ant-tabs-top > .ant-tabs-nav::before {
            border-bottom-color: rgba(226, 232, 240, 0.82);
          }

          .operation-strategy-shell .ant-tabs-tab {
            margin: 0 22px 0 0;
            padding: 10px 0 12px;
            color: #64748b;
            font-size: 13px;
            font-weight: 600;
          }

          .operation-strategy-shell .ant-tabs-tab:hover {
            color: #1677ff;
          }

          .operation-strategy-shell .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
            color: #1677ff;
            text-shadow: none;
          }

          .operation-strategy-shell .ant-tabs-ink-bar {
            height: 2px;
            border-radius: 999px;
            background: #38bdf8;
          }

          .operation-strategy-shell .ant-tabs-content-holder {
            color: #334155;
          }
        `}
      </style>
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
          style={{
            borderRadius: 8,
            borderColor: '#e8edf5',
            background: 'rgba(255, 255, 255, 0.82)',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.05)',
          }}
          styles={{ body: { padding: 16 } }}
        >
          <Tabs
            destroyOnHidden={false}
            items={[
              { key: 'hooks', label: t('operationStrategy.tabs.hooks'), children: <HookTemplateManager /> },
              { key: 'scripts', label: t('operationStrategy.tabs.scripts'), children: <ScriptTemplateManager mode="style-prompts" /> },
              { key: 'auto-classifier', label: t('operationStrategy.stylePrompts.subtabs.autoClassifier'), children: <ScriptTemplateManager mode="auto-classifier" /> },
              { key: 'accounts', label: t('operationStrategy.tabs.accounts'), children: <AccountOpsConfigManager /> },
            ]}
          />
        </Card>
      </section>
    </main>
  )
}
