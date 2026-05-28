'use client'

import { Tabs } from 'antd'
import { useTranslation } from 'react-i18next'
import { AccountOpsConfigPanel } from '../AccountOpsConfigPanel'
import { HookTemplateManager } from '../HookTemplateManager'
import { ScriptTemplateManager } from '../ScriptTemplateManager'

export function StrategyManagementPanel() {
  const { t } = useTranslation('route')
  return (
    <Tabs
      items={[
        { key: 'hooks', label: t('acquisition.strategy.hooks'), children: <HookTemplateManager /> },
        { key: 'scripts', label: t('acquisition.strategy.scripts'), children: <ScriptTemplateManager /> },
        { key: 'accounts', label: t('acquisition.strategy.accounts'), children: <AccountOpsConfigPanel /> },
      ]}
    />
  )
}
