import type React from 'react'
import type { LeadLabels } from '../types'
import type { AcquisitionPlatform } from '@/api/acquisition'
import { Alert, Space, Tag } from 'antd'

interface PrivateMessageCapabilityItem {
  platform: AcquisitionPlatform
  status: string
  reason: string
  metadata?: Record<string, unknown>
}

interface PrivateMessageStatusPanelProps {
  capability: PrivateMessageCapabilityItem[]
  labels: LeadLabels
}

function getCapabilityColor(status: string) {
  if (status === 'ready')
    return 'green'
  if (status === 'manual_required')
    return 'blue'
  if (status === 'permission_required')
    return 'orange'
  return 'default'
}

const PrivateMessageStatusPanel: React.FC<PrivateMessageStatusPanelProps> = ({ capability, labels }) => {
  const douyin = capability.find(item => item.platform === 'douyin')
  return (
    <Alert
      type="info"
      showIcon
      message={labels.ui.douyinCreatorStatusTitle || labels.ui.privateMessageStatus}
      description={(
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          <Space wrap>
            {capability.map(item => (
              <Tag key={`${item.platform}-${item.status}`} color={getCapabilityColor(item.status)}>
                {labels.platform[item.platform]}
                :
                {labels.capabilityStatus[item.status] || item.status}
              </Tag>
            ))}
          </Space>
          {douyin ? (
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <span>{douyin.reason}</span>
              {douyin.metadata?.toolsDir ? (
                <span>
                  {labels.ui.douyinCreatorToolsDir}
                  :
                  {' '}
                  {String(douyin.metadata.toolsDir)}
                </span>
              ) : null}
              {douyin.metadata?.profileDir ? (
                <span>
                  {labels.ui.douyinCreatorProfileDir}
                  :
                  {' '}
                  {String(douyin.metadata.profileDir)}
                </span>
              ) : null}
              <span>{labels.ui.douyinLocalAutomationNotice}</span>
            </Space>
          ) : null}
        </Space>
      )}
    />
  )
}

export default PrivateMessageStatusPanel
