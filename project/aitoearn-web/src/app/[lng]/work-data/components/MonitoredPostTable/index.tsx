import React from 'react'
import { Table, Space, Button, Tag, Tooltip, Image, message } from 'antd'
import {
  CommentOutlined,
  EyeOutlined,
  HeartOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ShareAltOutlined,
  StarOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useTransClient } from '@/app/i18n/client'
import { useParams } from 'next/navigation'
import type { MonitoredPostItem } from '@/api/workData'
import { fetchMonitoredPost, updateMonitoredPostStatus } from '@/api/workData'
import dayjs from 'dayjs'

interface MonitoredPostTableProps {
  loading: boolean
  data: MonitoredPostItem[]
  total: number
  page: number
  pageSize: number
  onChange: (page: number, pageSize: number) => void
  onViewDetail: (item: MonitoredPostItem) => void
  onRefresh: () => void
}

const MonitoredPostTable: React.FC<MonitoredPostTableProps> = ({
  loading,
  data,
  total,
  page,
  pageSize,
  onChange,
  onViewDetail,
  onRefresh,
}) => {
  const { lng } = useParams()
  const { t } = useTransClient('route')

  const handleFetch = async (id: string) => {
    try {
      await fetchMonitoredPost(id)
      message.success(t('workData.fetchStarted'))
      onRefresh()
    } catch (error: any) {
      message.error(error.message || t('workData.fetchFailed'))
    }
  }

  const handleToggleStatus = async (record: MonitoredPostItem) => {
    const nextStatus = record.monitorStatus === 'active' ? 'paused' : 'active'
    try {
      await updateMonitoredPostStatus(record.id, nextStatus)
      message.success(t(nextStatus === 'paused' ? 'workData.pauseSuccess' : 'workData.resumeSuccess'))
      onRefresh()
    } catch (error: any) {
      message.error(error.message || t('workData.statusUpdateFailed'))
    }
  }

  const shouldIgnoreRowClick = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(target.closest('a, button, .ant-btn, .ant-dropdown-trigger, .ant-pagination, .ant-select'))
  }

  const metricItems = [
    { key: 'likeCount', label: t('workData.metrics.likes'), icon: <HeartOutlined />, color: '#1677ff' },
    { key: 'collectCount', label: t('workData.metrics.collects'), icon: <StarOutlined />, color: '#2f80ed' },
    { key: 'commentCount', label: t('workData.metrics.comments'), icon: <CommentOutlined />, color: '#2563eb' },
    { key: 'shareCount', label: t('workData.metrics.shares'), icon: <ShareAltOutlined />, color: '#0891b2' },
  ]

  const columns = [
    {
      title: t('workData.columns.post'),
      dataIndex: 'title',
      key: 'post',
      width: 330,
      render: (_: string, record: MonitoredPostItem) => (
        <Space size={12} style={{ cursor: 'pointer' }}>
          {record.cover ? (
            <Image
              src={record.cover}
              width={54}
              height={54}
              style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #dbeafe' }}
              preview={false}
            />
          ) : (
            <div style={{
              display: 'grid',
              placeItems: 'center',
              width: 54,
              height: 54,
              borderRadius: 8,
              border: '1px solid #dbeafe',
              background: '#eff6ff',
              color: '#5b7ea6',
              fontSize: 12,
            }}>
              {t('workData.noCover')}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div
              title={t('workData.actions.detail')}
              style={{ fontWeight: 700, maxWidth: 230, color: '#1677ff' }}
              className="truncate"
            >
              {record.title || t('workData.noTitle')}
            </div>
            <a
              href={record.postUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, color: '#6b7b8c' }}
              onClick={event => event.stopPropagation()}
            >
              {record.postId}
            </a>
          </div>
        </Space>
      ),
    },
    {
      title: t('workData.columns.platform'),
      dataIndex: 'platform',
      key: 'platform',
      width: 180,
      render: (platform: string, record: MonitoredPostItem) => (
        <div>
          <Tag color={platform === 'xhs' ? 'blue' : platform === 'douyin' ? 'cyan' : 'geekblue'} style={{ borderRadius: 999 }}>
            {t(`acquisition.platform.${platform}`)}
          </Tag>
          <div style={{ marginTop: 6, fontSize: 12, color: '#6b7b8c', maxWidth: 150 }} className="truncate">{record.accountId}</div>
        </div>
      ),
    },
    {
      title: t('workData.columns.source'),
      dataIndex: 'source',
      key: 'source',
      width: 110,
      render: (source: string) => (
        <span style={{ color: '#425466', fontSize: 13 }}>{t(`workData.source.${source}`)}</span>
      ),
    },
    {
      title: t('workData.columns.monitorStatus'),
      dataIndex: 'monitorStatus',
      key: 'monitorStatus',
      width: 110,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'success',
          paused: 'default',
          failed: 'error',
          archived: 'warning',
        }
        return <Tag color={colorMap[status]} style={{ borderRadius: 999 }}>{t(`workData.status.${status}`)}</Tag>
      },
    },
    {
      title: t('workData.columns.fetchStatus'),
      dataIndex: 'fetchStatus',
      key: 'fetchStatus',
      width: 120,
      render: (status: string, record: MonitoredPostItem) => (
        <Tooltip title={record.capabilityReason}>
          <Tag color={status === 'ready' ? 'blue' : status === 'fetching' ? 'processing' : status === 'failed' ? 'error' : 'default'} style={{ borderRadius: 999 }}>
            {t(`workData.fetchStatus.${status}`)}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: t('workData.columns.metrics'),
      key: 'metrics',
      width: 260,
      render: (_: any, record: MonitoredPostItem) => {
        const metrics = record.latestMetrics || {}
        return (
          <Space wrap size={[6, 6]}>
            {metricItems.map(item => {
              const value = item.key === 'commentCount'
                ? (metrics[item.key] ?? record.latestCommentCount)
                : metrics[item.key]
              return (
                <Tooltip key={item.key} title={item.label}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    minWidth: 58,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: value === undefined ? '#f3f6f8' : `${item.color}12`,
                    color: value === undefined ? '#9aa7b3' : item.color,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {item.icon}
                    {value ?? '-'}
                  </span>
                </Tooltip>
              )
            })}
          </Space>
        )
      },
    },
    {
      title: t('workData.columns.comments'),
      dataIndex: 'latestCommentCount',
      key: 'comments',
      width: 88,
      render: (value: number) => <strong style={{ color: '#1e3a5f' }}>{value || 0}</strong>,
    },
    {
      title: t('workData.columns.lastFetchedAt'),
      dataIndex: 'lastFetchedAt',
      key: 'lastFetchedAt',
      width: 150,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: t('workData.columns.actions'),
      key: 'actions',
      fixed: 'right' as const,
      width: 132,
      render: (_: any, record: MonitoredPostItem) => (
        <Space size={4}>
          <Tooltip title={t('workData.actions.fetch')}>
            <Button
              type="text"
              icon={<SyncOutlined spin={record.fetchStatus === 'fetching'} />}
              onClick={() => handleFetch(record.id)}
              disabled={record.fetchStatus === 'fetching'}
            />
          </Tooltip>
          <Tooltip title={t('workData.actions.detail')}>
            <Button type="text" icon={<EyeOutlined />} onClick={() => onViewDetail(record)} />
          </Tooltip>
          {record.monitorStatus === 'active' ? (
            <Tooltip title={t('workData.actions.pause')}>
              <Button type="text" icon={<PauseCircleOutlined />} onClick={() => handleToggleStatus(record)} />
            </Tooltip>
          ) : (
            <Tooltip title={t('workData.actions.resume')}>
              <Button type="text" icon={<PlayCircleOutlined />} onClick={() => handleToggleStatus(record)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Table
      loading={loading}
      dataSource={data}
      columns={columns}
      rowKey="id"
      size="middle"
      scroll={{ x: 1300 }}
      style={{ padding: 16 }}
      onRow={record => ({
        onClick: event => {
          if (shouldIgnoreRowClick(event.target)) return
          onViewDetail(record)
        },
        onKeyDown: event => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          if (shouldIgnoreRowClick(event.target)) return
          event.preventDefault()
          onViewDetail(record)
        },
        tabIndex: 0,
        style: { cursor: 'pointer' },
      })}
      pagination={{
        current: page,
        pageSize,
        total,
        onChange,
        showSizeChanger: true,
      }}
    />
  )
}

export default MonitoredPostTable
