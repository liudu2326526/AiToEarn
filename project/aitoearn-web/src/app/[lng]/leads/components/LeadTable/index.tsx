import React from 'react'
import { Avatar, Button, Select, Space, Table, Tag, Typography, message } from 'antd'
import { TeamOutlined } from '@ant-design/icons'
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
      width: 150,
      render: (_: unknown, record: LeadItem) => (
        <Space direction="vertical" size={2}>
          <Tag color="blue">{labels.platform[record.platform]}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.accountId}</Text>
        </Space>
      ),
    },
    {
      title: labels.ui.sourceUser,
      key: 'user',
      width: 180,
      render: (_: unknown, record: LeadItem) => (
        <Space>
          <Avatar src={record.userAvatar}>{record.userName?.slice(0, 1)}</Avatar>
          <Text strong>{record.userName || labels.ui.unknownUser}</Text>
        </Space>
      ),
    },
    {
      title: labels.ui.commentContent,
      dataIndex: 'sourceContent',
      key: 'sourceContent',
      render: (value: string) => (
        <Text style={{ display: 'block', maxWidth: 420 }} ellipsis={{ tooltip: value }}>
          {value || '-'}
        </Text>
      ),
    },
    {
      title: labels.ui.stageStatus,
      key: 'stage',
      width: 170,
      render: (_: unknown, record: LeadItem) => (
        <LeadStageTag stage={record.stage} status={record.status} labels={labels} />
      ),
    },
    {
      title: labels.ui.assignee,
      dataIndex: 'assignee',
      key: 'assignee',
      width: 140,
      render: (value: string) => value || <Text type="secondary">{labels.ui.unassigned}</Text>,
    },
    {
      title: labels.ui.lastFollowUp,
      dataIndex: 'lastFollowUpAt',
      key: 'lastFollowUpAt',
      width: 170,
      render: (value?: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: labels.ui.actions,
      key: 'actions',
      width: 220,
      render: (_: unknown, record: LeadItem) => (
        <Space>
          <Button size="small" onClick={() => onOpenDetail(record)}>{labels.ui.detail}</Button>
          <Button size="small" icon={<TeamOutlined />} onClick={async () => {
            await claimLead(record.id)
            message.success(labels.ui.claimSuccess)
            await onRefresh()
          }}>{labels.ui.claim}</Button>
          <Select
            size="small"
            value={record.stage}
            style={{ width: 96 }}
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
      rowSelection={{ selectedRowKeys, onChange: onSelectionChange }}
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
