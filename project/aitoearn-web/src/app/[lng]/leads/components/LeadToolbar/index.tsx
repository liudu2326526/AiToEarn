import type React from 'react'
import type { LeadLabels, LeadPostOption } from '../types'
import type { AcquisitionPlatform } from '@/api/acquisition'
import type { LeadSourceType, LeadStage, LeadStatus } from '@/api/leads'
import { DownloadOutlined, FormOutlined, ReloadOutlined, ThunderboltOutlined, UserSwitchOutlined } from '@ant-design/icons'
import { Button, Card, Input, Select, Space } from 'antd'

interface LeadToolbarProps {
  labels: LeadLabels
  platform?: AcquisitionPlatform
  stage?: LeadStage
  status?: LeadStatus
  sourceType?: LeadSourceType
  postId?: string
  postOptions: LeadPostOption[]
  materializing: boolean
  importingDouyinComments: boolean
  importingDouyinDms: boolean
  preparingDouyinPublish: boolean
  douyinCreatorConfigured: boolean
  autoSelecting: boolean
  autoReplying: boolean
  hasSelection: boolean
  onPlatformChange: (value?: AcquisitionPlatform) => void
  onStageChange: (value?: LeadStage) => void
  onStatusChange: (value?: LeadStatus) => void
  onSourceTypeChange: (value?: LeadSourceType) => void
  onPostChange: (value?: string) => void
  onSearch: (value: string) => void
  onRefresh: () => void
  onMaterialize: () => void
  onImportDouyinComments: () => void
  onImportDouyinDms: () => void
  onPrepareDouyinPublish: () => void
  onRefreshDouyinStatus: () => void
  onAutoSelectReplyStyle: () => void
  onBatchAutoReply: () => void
  onBatchAssign: () => void
}

const toOptions = (record: Record<string, string>) => Object.entries(record).map(([value, label]) => ({ value, label }))

const toolbarBodyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const filtersStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
  flex: '1 1 620px',
}

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
}

const pillButtonStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 999,
  borderColor: '#d8e1ec',
  background: 'rgba(248, 250, 252, 0.82)',
  color: '#334155',
  fontWeight: 600,
  paddingInline: 16,
  boxShadow: '0 6px 16px rgba(15, 23, 42, 0.04)',
}

const primaryPillButtonStyle: React.CSSProperties = {
  ...pillButtonStyle,
  borderColor: '#1677ff',
  background: '#1677ff',
  color: '#ffffff',
  boxShadow: '0 8px 18px rgba(22, 119, 255, 0.18)',
}

const softBluePillButtonStyle: React.CSSProperties = {
  ...pillButtonStyle,
  borderColor: '#9bd7ff',
  background: 'rgba(239, 248, 255, 0.9)',
  color: '#1677ff',
}

function getBatchButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    ...pillButtonStyle,
    opacity: enabled ? 1 : 0.5,
    cursor: enabled ? 'pointer' : 'not-allowed',
  }
}

const LeadToolbar: React.FC<LeadToolbarProps> = ({
  labels,
  platform,
  stage,
  status,
  sourceType,
  postId,
  postOptions,
  materializing,
  importingDouyinComments,
  importingDouyinDms,
  preparingDouyinPublish,
  douyinCreatorConfigured,
  autoSelecting,
  autoReplying,
  hasSelection,
  onPlatformChange,
  onStageChange,
  onStatusChange,
  onSourceTypeChange,
  onPostChange,
  onSearch,
  onRefresh,
  onMaterialize,
  onImportDouyinComments,
  onImportDouyinDms,
  onPrepareDouyinPublish,
  onRefreshDouyinStatus,
  onAutoSelectReplyStyle,
  onBatchAutoReply,
  onBatchAssign,
}) => (
  <Card
    size="small"
    style={{
      borderRadius: 8,
      borderColor: '#e8edf5',
      background: 'rgba(255, 255, 255, 0.82)',
      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.05)',
    }}
    styles={{ body: { padding: 12 } }}
  >
    <div style={toolbarBodyStyle}>
      <div style={filtersStyle}>
        <Select
          allowClear
          placeholder={labels.ui.platform}
          value={platform}
          style={{ width: 132 }}
          onChange={onPlatformChange}
          options={toOptions(labels.platform)}
        />
        <Select
          allowClear
          placeholder={labels.ui.stage}
          value={stage}
          style={{ width: 148 }}
          onChange={onStageChange}
          options={toOptions(labels.stage)}
        />
        <Select
          allowClear
          placeholder={labels.ui.status}
          value={status}
          style={{ width: 132 }}
          onChange={onStatusChange}
          options={toOptions(labels.status)}
        />
        <Select
          allowClear
          placeholder={labels.ui.sourceType}
          value={sourceType}
          style={{ width: 132 }}
          onChange={onSourceTypeChange}
          options={toOptions(labels.sourceType)}
        />
        <Select
          allowClear
          showSearch
          placeholder={labels.ui.post}
          value={postId}
          style={{ width: 220 }}
          optionFilterProp="label"
          onChange={onPostChange}
          options={postOptions.map(option => ({ value: option.value, label: option.label }))}
        />
        <Input.Search
          placeholder={labels.ui.searchPlaceholder}
          allowClear
          style={{ width: 300, maxWidth: '100%' }}
          onSearch={onSearch}
        />
      </div>
      <Space style={actionsStyle}>
        <Button style={pillButtonStyle} icon={<ReloadOutlined />} onClick={onRefresh}>{labels.ui.refresh}</Button>
        <Button type="primary" style={primaryPillButtonStyle} loading={materializing} onClick={onMaterialize}>{labels.ui.materialize}</Button>
        <Button
          style={softBluePillButtonStyle}
          icon={<DownloadOutlined />}
          loading={importingDouyinComments}
          disabled={!douyinCreatorConfigured}
          onClick={onImportDouyinComments}
        >
          {labels.ui.importDouyinComments}
        </Button>
        <Button
          style={softBluePillButtonStyle}
          icon={<DownloadOutlined />}
          loading={importingDouyinDms}
          disabled={!douyinCreatorConfigured}
          onClick={onImportDouyinDms}
        >
          {labels.ui.importDouyinDms}
        </Button>
        <Button
          style={softBluePillButtonStyle}
          icon={<FormOutlined />}
          loading={preparingDouyinPublish}
          disabled={!douyinCreatorConfigured}
          onClick={onPrepareDouyinPublish}
        >
          {labels.ui.prepareDouyinPublish}
        </Button>
        <Button style={pillButtonStyle} icon={<ReloadOutlined />} onClick={onRefreshDouyinStatus}>
          {labels.ui.refreshDouyinStatus}
        </Button>
        <Button
          style={softBluePillButtonStyle}
          icon={<ThunderboltOutlined />}
          loading={autoSelecting}
          onClick={onAutoSelectReplyStyle}
        >
          {labels.ui.autoSelectReplyStyle}
        </Button>
        <Button
          style={softBluePillButtonStyle}
          icon={<ThunderboltOutlined />}
          loading={autoReplying}
          onClick={onBatchAutoReply}
        >
          {labels.ui.batchAutoReply}
        </Button>
        <Button
          style={getBatchButtonStyle(hasSelection)}
          icon={<UserSwitchOutlined />}
          disabled={!hasSelection}
          onClick={onBatchAssign}
        >
          {labels.ui.batchAssign}
        </Button>
      </Space>
    </div>
  </Card>
)

export default LeadToolbar
