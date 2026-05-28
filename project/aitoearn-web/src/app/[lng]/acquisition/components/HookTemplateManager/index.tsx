'use client'

import { Empty } from 'antd'
import { useTranslation } from 'react-i18next'

export function HookTemplateManager() {
  const { t } = useTranslation('route')
  return <Empty description={t('acquisition.strategy.hooksPlaceholder')} />
}
