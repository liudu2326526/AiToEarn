'use client'

import { Empty } from 'antd'
import { useTranslation } from 'react-i18next'

export function AccountOpsConfigPanel() {
  const { t } = useTranslation('route')
  return <Empty description={t('acquisition.strategy.accountsPlaceholder')} />
}
