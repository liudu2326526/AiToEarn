import React from 'react'
import { Tag } from 'antd'
import { useTransClient } from '@/app/i18n/client'
import { useParams } from 'next/navigation'

interface DataSourceBadgeProps {
  source: string
}

const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({ source }) => {
  const { lng } = useParams()
  const { t } = useTransClient('route')

  const sourceLabelMap: Record<string, string> = {
    xhs_plugin_api: t('workData.dataSource.xhsPluginApi'),
    xhs_bridge_capture: t('workData.dataSource.xhsBridgeCapture'),
    douyin_open_api: t('workData.dataSource.douyinOpenApi'),
    manual_snapshot: t('workData.dataSource.manualSnapshot'),
    demo_seed: t('workData.dataSource.demoSeed'),
  }

  const colorMap: Record<string, string> = {
    xhs_plugin_api: 'blue',
    xhs_bridge_capture: 'cyan',
    douyin_open_api: 'blue',
    manual_snapshot: 'geekblue',
    demo_seed: 'default',
  }

  return (
    <Tag color={colorMap[source] || 'default'} style={{ width: 'fit-content', borderRadius: 999, marginInlineEnd: 0 }}>
      {sourceLabelMap[source] || source}
    </Tag>
  )
}

export default DataSourceBadge
