import type React from 'react'
import { Alert, Space, Tag } from 'antd'
import type { AcquisitionPlatform } from '@/api/acquisition'
import type { LeadLabels } from '../types'

interface PrivateMessageCapabilityItem {
  platform: AcquisitionPlatform
  status: string
  reason: string
}

interface PrivateMessageStatusPanelProps {
  capability: PrivateMessageCapabilityItem[]
  labels: LeadLabels
}

const getCapabilityColor = (status: string) => {
  if (status === 'ready') return 'green'
  if (status === 'permission_required') return 'orange'
  return 'default'
}

const PrivateMessageStatusPanel: React.FC<PrivateMessageStatusPanelProps> = ({ capability, labels }) => (
  <Alert
    type="info"
    showIcon
    message={labels.ui.privateMessageStatus}
    description={(
      <Space wrap>
        {capability.map(item => (
          <Tag key={`${item.platform}-${item.status}`} color={getCapabilityColor(item.status)}>
            {labels.platform[item.platform]}: {labels.capabilityStatus[item.status] || item.status}
          </Tag>
        ))}
      </Space>
    )}
  />
)

export default PrivateMessageStatusPanel
