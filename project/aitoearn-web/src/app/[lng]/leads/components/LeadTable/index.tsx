import React from 'react'
import { Avatar, Button, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd'
import { EyeOutlined, TeamOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { LeadItem, LeadStage } from '@/api/leads'
import { claimLead, updateLeadStage } from '@/api/leads'
import LeadStageTag from '../LeadStageTag'
import type { LeadLabels } from '../types'

const { Text } = Typography

interface LeadTableProps {
  labels: LeadLabels
  leads: LeadItem[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  selectedRowKeys: React.Key[]
  onSelectionChange: (keys: React.Key[]) => void
  onPageChange: (page: number, pageSize: number) => void
  onOpenDetail: (lead: LeadItem) => void
  onRefresh: () => Promise<void>
}

const ellipsisTextStyle: React.CSSProperties = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const commentPreviewStyle: React.CSSProperties = {
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  lineHeight: 1.55,
  wordBreak: 'break-word',
}

const compactButtonStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
}

const formatAssignee = (value?: string) => {
  if (!value) return ''
  return value.length > 10 ? `${value.slice(0, 8)}...` : value
}

const LeadTable: React.FC<LeadTableProps> = ({
  labels,
  leads,
  loading,
  page,
  pageSize,
  total,
  selectedRowKeys,
  onSelectionChange,
  onPageChange,
  onOpenDetail,
  onRefresh,
}) => {
  const columns = [
    {
      title: labels.ui.platformAccount,
      key: 'platform',
      width: 135,
      render: (_: unknown, record: LeadItem) => (
        <div style={{ minWidth: 0 }}>
          <Tag color="blue" style={{ marginBottom: 6 }}>{labels.platform[record.platform]}</Tag>
          <Tooltip title={record.accountId}>
            <Text
              type="secondary"
              style={{ ...ellipsisTextStyle, maxWidth: 100, fontSize: 12 }}
            >
              {record.accountId}
            </Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: labels.ui.sourceUser,
      key: 'user',
      width: 150,
      render: (_: unknown, record: LeadItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar src={record.userAvatar} style={{ flex: '0 0 auto' }}>{record.userName?.slice(0, 1)}</Avatar>
          <Tooltip title={record.userName || labels.ui.unknownUser}>
            <Text strong style={{ ...ellipsisTextStyle, maxWidth: 96 }}>
              {record.userName || labels.ui.unknownUser}
            </Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: labels.ui.commentContent,
      dataIndex: 'sourceContent',
      key: 'sourceContent',
      width: 280,
      render: (value: string) => (
        <Tooltip title={value}>
          <div style={commentPreviewStyle}>{value || '-'}</div>
        </Tooltip>
      ),
    },
    {
      title: labels.ui.stageStatus,
      key: 'stage',
      width: 110,
      render: (_: unknown, record: LeadItem) => (
        <LeadStageTag stage={record.stage} status={record.status} labels={labels} />
      ),
    },
    {
      title: labels.ui.assignee,
      dataIndex: 'assignee',
      key: 'assignee',
      width: 92,
      render: (value?: string) => value
        ? (
            <Tooltip title={value}>
              <Text style={{ ...ellipsisTextStyle, maxWidth: 64 }}>{formatAssignee(value)}</Text>
            </Tooltip>
          )
        : <Text type="secondary">{labels.ui.unassigned}</Text>,
    },
    {
      title: labels.ui.lastFollowUp,
      dataIndex: 'lastFollowUpAt',
      key: 'lastFollowUpAt',
      width: 96,
      render: (value?: string) => value
        ? (
            <Tooltip title={dayjs(value).format('YYYY-MM-DD HH:mm')}>
              <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{dayjs(value).format('MM-DD HH:mm')}</Text>
            </Tooltip>
          )
        : '-',
    },
    {
      title: labels.ui.actions,
      key: 'actions',
      width: 178,
      fixed: 'right' as const,
      render: (_: unknown, record: LeadItem) => (
        <Space size={6} wrap={false}>
          <Tooltip title={labels.ui.detail}>
            <Button
              aria-label={labels.ui.detail}
              size="small"
              icon={<EyeOutlined />}
              style={compactButtonStyle}
              onClick={() => onOpenDetail(record)}
            />
          </Tooltip>
          <Tooltip title={labels.ui.claim}>
            <Button
              aria-label={labels.ui.claim}
              size="small"
              icon={<TeamOutlined />}
              style={compactButtonStyle}
              onClick={async () => {
                await claimLead(record.id)
                message.success(labels.ui.claimSuccess)
                await onRefresh()
              }}
            />
          </Tooltip>
          <Select
            size="small"
            value={record.stage}
            style={{ width: 90 }}
            onChange={async value => {
              await updateLeadStage(record.id, value as LeadStage)
              await onRefresh()
            }}
            options={Object.entries(labels.stage).map(([value, label]) => ({ value, label }))}
          />
        </Space>
      ),
    },
  ]

  return (
    <Table
      rowKey="id"
      loading={loading}
      dataSource={leads}
      columns={columns}
      size="middle"
      tableLayout="fixed"
      scroll={{ x: 1088 }}
      rowSelection={{ selectedRowKeys, onChange: onSelectionChange, columnWidth: 48, fixed: true }}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        onChange: onPageChange,
      }}
    />
  )
}

export default LeadTable
