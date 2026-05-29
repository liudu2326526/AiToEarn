import type React from 'react'
import { Button, Card, Input, Select, Space } from 'antd'
import { ReloadOutlined, UserSwitchOutlined } from '@ant-design/icons'
import type { AcquisitionPlatform } from '@/api/acquisition'
import type { LeadStage, LeadStatus } from '@/api/leads'
import type { LeadLabels } from '../types'

interface LeadToolbarProps {
  labels: LeadLabels
  platform?: AcquisitionPlatform
  stage?: LeadStage
  status?: LeadStatus
  materializing: boolean
  hasSelection: boolean
  onPlatformChange: (value?: AcquisitionPlatform) => void
  onStageChange: (value?: LeadStage) => void
  onStatusChange: (value?: LeadStatus) => void
  onSearch: (value: string) => void
  onRefresh: () => void
  onMaterialize: () => void
  onBatchAssign: () => void
}

const toOptions = (record: Record<string, string>) => Object.entries(record).map(([value, label]) => ({ value, label }))

const LeadToolbar: React.FC<LeadToolbarProps> = ({
  labels,
  platform,
  stage,
  status,
  materializing,
  hasSelection,
  onPlatformChange,
  onStageChange,
  onStatusChange,
  onSearch,
  onRefresh,
  onMaterialize,
  onBatchAssign,
}) => (
  <Card size="small" style={{ borderRadius: 8 }}>
    <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
      <Space wrap>
        <Select
          allowClear
          placeholder={labels.ui.platform}
          value={platform}
          style={{ width: 120 }}
          onChange={onPlatformChange}
          options={toOptions(labels.platform)}
        />
        <Select
          allowClear
          placeholder={labels.ui.stage}
          value={stage}
          style={{ width: 140 }}
          onChange={onStageChange}
          options={toOptions(labels.stage)}
        />
        <Select
          allowClear
          placeholder={labels.ui.status}
          value={status}
          style={{ width: 120 }}
          onChange={onStatusChange}
          options={toOptions(labels.status)}
        />
        <Input.Search
          placeholder={labels.ui.searchPlaceholder}
          allowClear
          style={{ width: 260 }}
          onSearch={onSearch}
        />
      </Space>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>{labels.ui.refresh}</Button>
        <Button type="primary" loading={materializing} onClick={onMaterialize}>{labels.ui.materialize}</Button>
        <Button icon={<UserSwitchOutlined />} disabled={!hasSelection} onClick={onBatchAssign}>{labels.ui.batchAssign}</Button>
      </Space>
    </Space>
  </Card>
)

export default LeadToolbar
