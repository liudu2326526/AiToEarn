import type React from 'react'
import { Space, Tag } from 'antd'
import type { LeadStage, LeadStatus } from '@/api/leads'
import type { LeadLabels } from '../types'
import { statusColor } from '../types'

interface LeadStageTagProps {
  stage: LeadStage
  status: LeadStatus
  labels: LeadLabels
  direction?: 'horizontal' | 'vertical'
}

const LeadStageTag: React.FC<LeadStageTagProps> = ({ stage, status, labels, direction = 'vertical' }) => (
  <Space direction={direction} size={4}>
    <Tag>{labels.stage[stage]}</Tag>
    <Tag color={statusColor[status]}>{labels.status[status]}</Tag>
  </Space>
)

export default LeadStageTag
