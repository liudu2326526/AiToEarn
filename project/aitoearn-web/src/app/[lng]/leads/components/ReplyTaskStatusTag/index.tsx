import { Tag } from 'antd'
import type { LeadReplyTaskStatus } from '@/api/leads'

const STATUS_COLOR: Record<LeadReplyTaskStatus, string> = {
  pending: 'default',
  queued: 'processing',
  running: 'blue',
  success: 'green',
  failed: 'red',
  blocked: 'red',
  human_required: 'gold',
  cancelled: 'default',
}

interface ReplyTaskStatusTagProps {
  status: LeadReplyTaskStatus
  label: string
}

export default function ReplyTaskStatusTag({ status, label }: ReplyTaskStatusTagProps) {
  return <Tag color={STATUS_COLOR[status]}>{label}</Tag>
}
