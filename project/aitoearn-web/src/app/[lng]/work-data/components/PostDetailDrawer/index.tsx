import React, { useEffect, useMemo, useState } from 'react'
import { Avatar, Card, Drawer, Empty, Input, List, Segmented, Space, Spin, Table, Tabs, Tag, Typography } from 'antd'
import { CommentOutlined, HeartOutlined, ShareAltOutlined, StarOutlined } from '@ant-design/icons'
import { useTransClient } from '@/app/i18n/client'
import { useParams } from 'next/navigation'
import type { MonitoredPostItem, WorkCommentItem, WorkCommentSortBy, WorkSnapshotItem } from '@/api/workData'
import { listMonitoredPostComments, listMonitoredPostSnapshots } from '@/api/workData'
import DataSourceBadge from '../DataSourceBadge'
import dayjs from 'dayjs'
import xhsLogo from '@/assets/svgs/plat/xhs.svg'
import douyinLogo from '@/assets/svgs/plat/douyin.svg'
import kwaiLogo from '@/assets/svgs/plat/ks.svg'

const { Text } = Typography

interface CommentThread extends WorkCommentItem {
  replies: WorkCommentItem[]
}

const platformLogos: Record<string, string> = {
  xhs: xhsLogo,
  douyin: douyinLogo,
  kwai: kwaiLogo,
}

const toTimestamp = (value?: string) => {
  if (!value) return 0
  const timestamp = dayjs(value).valueOf()
  return Number.isFinite(timestamp) ? timestamp : 0
}

const sortComments = <T extends WorkCommentItem>(items: T[], sortBy: WorkCommentSortBy) => {
  return [...items].sort((a, b) => {
    if (sortBy === 'like') {
      return (b.likeCount || 0) - (a.likeCount || 0) || toTimestamp(b.commentedAt) - toTimestamp(a.commentedAt)
    }
    return toTimestamp(b.commentedAt) - toTimestamp(a.commentedAt) || (b.likeCount || 0) - (a.likeCount || 0)
  })
}

const buildCommentThreads = (comments: WorkCommentItem[], sortBy: WorkCommentSortBy): CommentThread[] => {
  const nodeMap = new Map<string, CommentThread>()
  comments.forEach(comment => {
    nodeMap.set(comment.commentId, { ...comment, replies: [] })
  })

  const roots: CommentThread[] = []
  comments.forEach(comment => {
    const node = nodeMap.get(comment.commentId)
    if (!node) return

    const parentId = comment.parentCommentId || ''
    const parent = parentId ? nodeMap.get(parentId) : undefined
    if (parent && parent.commentId !== node.commentId) {
      parent.replies.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortedRoots = sortComments(roots, sortBy)
  sortedRoots.forEach(root => {
    root.replies = sortComments(root.replies, sortBy)
  })
  return sortedRoots
}

interface PostDetailDrawerProps {
  visible: boolean
  post: MonitoredPostItem | null
  onClose: () => void
}

const PostDetailDrawer: React.FC<PostDetailDrawerProps> = ({ visible, post, onClose }) => {
  const { lng } = useParams()
  const { t } = useTransClient('route')

  const [comments, setComments] = useState<WorkCommentItem[]>([])
  const [commentTotal, setCommentTotal] = useState(0)
  const [commentLoading, setCommentLoading] = useState(false)
  const [commentKeyword, setCommentKeyword] = useState('')
  const [commentSortBy, setCommentSortBy] = useState<WorkCommentSortBy>('time')
  const [activeTab, setActiveTab] = useState('comments')

  const [snapshots, setSnapshots] = useState<WorkSnapshotItem[]>([])
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  const fetchComments = async () => {
    if (!post) return
    setCommentLoading(true)
    try {
      const res = await listMonitoredPostComments(post.id, {
        page: 1,
        pageSize: 1000,
        keyword: commentKeyword,
        sortBy: commentSortBy,
      })
      setComments(res.list)
      setCommentTotal(res.total)
    } catch (error) {
      console.error(error)
    } finally {
      setCommentLoading(false)
    }
  }

  const fetchSnapshots = async () => {
    if (!post) return
    setSnapshotLoading(true)
    try {
      const res = await listMonitoredPostSnapshots(post.id, { limit: 50 })
      setSnapshots(res)
    } catch (error) {
      console.error(error)
    } finally {
      setSnapshotLoading(false)
    }
  }

  useEffect(() => {
    if (visible && post) {
      setActiveTab('comments')
      fetchComments()
    }
  }, [visible, post, commentKeyword, commentSortBy])

  useEffect(() => {
    if (visible && post) {
      fetchSnapshots()
    }
  }, [visible, post])

  const metricItems = [
    { key: 'likeCount', label: t('workData.metrics.likes'), icon: <HeartOutlined />, color: '#1677ff' },
    { key: 'collectCount', label: t('workData.metrics.collects'), icon: <StarOutlined />, color: '#2f80ed' },
    { key: 'commentCount', label: t('workData.metrics.comments'), icon: <CommentOutlined />, color: '#2563eb' },
    { key: 'shareCount', label: t('workData.metrics.shares'), icon: <ShareAltOutlined />, color: '#0891b2' },
  ]

  const getPlatformLabel = (platform: string) => {
    return t(`acquisition.platform.${platform}`)
  }

  const commentThreads = useMemo(() => buildCommentThreads(comments, commentSortBy), [comments, commentSortBy])

  const renderCommentMeta = (comment: WorkCommentItem) => {
    const items = [
      comment.commentedAt ? dayjs(comment.commentedAt).format('YYYY-MM-DD HH:mm') : '',
      comment.ipLocation,
    ].filter(Boolean)

    return items.join(' · ') || '-'
  }

  const renderComment = (comment: WorkCommentItem, isReply = false) => (
    <div
      key={comment.id || comment.commentId}
      style={{
        display: 'grid',
        gridTemplateColumns: isReply ? '28px minmax(0, 1fr)' : '36px minmax(0, 1fr)',
        gap: 10,
        padding: isReply ? '12px 0 0' : '16px 0',
      }}
    >
      <Avatar src={comment.userAvatar} size={isReply ? 28 : 36} style={{ background: '#eaf4ff', color: '#1677ff' }}>
        {comment.userName?.slice(0, 1)}
      </Avatar>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#1f2633', fontSize: isReply ? 13 : 14 }}>
                {comment.userName || t('workData.comments.unknownUser')}
              </span>
              {isReply && (
                <Tag color="default" style={{ marginInlineEnd: 0, borderRadius: 999, fontSize: 11 }}>
                  {t('workData.comments.reply')}
                </Tag>
              )}
            </div>
            <div style={{ marginTop: 5, color: '#253044', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {comment.content}
            </div>
          </div>
          <Tag
            color={comment.likeCount > 0 ? 'blue' : 'default'}
            style={{ flex: '0 0 auto', borderRadius: 999, height: 24, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <HeartOutlined /> {comment.likeCount || 0}
          </Tag>
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{renderCommentMeta(comment)}</Text>
          {!isReply && <DataSourceBadge source={comment.dataSource} />}
        </div>
      </div>
    </div>
  )

  const renderCommentThread = (thread: CommentThread) => (
    <div
      key={thread.id || thread.commentId}
      style={{
        borderBottom: '1px solid #edf0f5',
      }}
    >
      {renderComment(thread)}
      {thread.replies.length > 0 && (
        <div
          style={{
            margin: '0 0 14px 46px',
            padding: '2px 14px 12px',
            borderLeft: '2px solid #bfdbfe',
            borderRadius: 8,
            background: '#f5faff',
          }}
        >
          {thread.replies.map(reply => renderComment(reply, true))}
        </div>
      )}
    </div>
  )

  const snapshotColumns = [
    {
      title: t('workData.snapshots.fetchedAt'),
      dataIndex: 'fetchedAt',
      key: 'fetchedAt',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('workData.snapshots.metrics'),
      key: 'metrics',
      render: (_: any, record: WorkSnapshotItem) => (
        <Space wrap>
          {metricItems.map(item => {
            const value = record.metrics?.normalized?.[item.key]
            return (
              <Tag key={item.key} color={value === undefined ? 'default' : 'blue'} style={{ borderRadius: 999 }}>
                {item.label}: {value ?? '-'}
              </Tag>
            )
          })}
        </Space>
      ),
    },
    {
      title: t('workData.snapshots.source'),
      key: 'source',
      render: (_: any, record: WorkSnapshotItem) => (
        <DataSourceBadge source={record.dataSource} />
      ),
    },
  ]

  return (
    <Drawer
      title={post ? (
        <Space size={12}>
          <Avatar shape="square" size={44} src={post.cover} style={{ borderRadius: 8, background: '#eaf4ff', color: '#1677ff' }}>
            {platformLogos[post.platform] ? (
              <img
                src={platformLogos[post.platform]}
                alt={getPlatformLabel(post.platform)}
                style={{ width: 28, height: 28, borderRadius: 6 }}
              />
            ) : getPlatformLabel(post.platform)}
          </Avatar>
          <Space direction="vertical" size={2}>
            <span style={{ maxWidth: 620, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {post.title || t('workData.detailTitle')}
            </span>
            <Text type="secondary" style={{ fontSize: 12 }}>{post.postId}</Text>
          </Space>
        </Space>
      ) : t('workData.detailTitle')}
      width={920}
      onClose={onClose}
      open={visible}
      destroyOnHidden
    >
      {post && (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: t('workData.tabs.overview'),
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Card size="small" title={t('workData.overview.metrics')} style={{ borderRadius: 8 }}>
                    <Space wrap size={[10, 10]}>
                      {metricItems.map(item => {
                        const value = item.key === 'commentCount'
                          ? (post.latestMetrics?.[item.key] ?? post.latestCommentCount)
                          : post.latestMetrics?.[item.key]
                        return (
                          <div key={item.key} style={{
                            minWidth: 132,
                            padding: '14px 16px',
                            borderRadius: 8,
                            border: '1px solid #e2ebf2',
                            background: value === undefined ? '#f8fafc' : `${item.color}10`,
                          }}>
                            <Space style={{ color: item.color, fontWeight: 700 }}>
                              {item.icon}
                              {item.label}
                            </Space>
                            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: value === undefined ? '#99a6b2' : '#172435' }}>
                              {value ?? '-'}
                            </div>
                          </div>
                        )
                      })}
                    </Space>
                  </Card>
                  <Card size="small" title={t('workData.overview.postInfo')} style={{ borderRadius: 8 }}>
                    <List size="small">
                      <List.Item><Text type="secondary">ID:</Text><Text copyable>{post.postId}</Text></List.Item>
                      <List.Item><Text type="secondary">URL:</Text><a href={post.postUrl} target="_blank" rel="noreferrer">{post.postUrl}</a></List.Item>
                      <List.Item><Text type="secondary">{t('workData.overview.platform')}:</Text><Tag>{getPlatformLabel(post.platform)}</Tag></List.Item>
                      <List.Item><Text type="secondary">{t('workData.overview.source')}:</Text><span>{t(`workData.source.${post.source}`)}</span></List.Item>
                    </List>
                  </Card>
                </Space>
              ),
            },
            {
              key: 'comments',
              label: `${t('workData.tabs.comments')} (${commentTotal || post.latestCommentCount || 0})`,
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Input.Search
                      placeholder={t('workData.comments.searchPlaceholder')}
                      onSearch={setCommentKeyword}
                      allowClear
                      style={{ maxWidth: 360 }}
                    />
                    <Segmented
                      value={commentSortBy}
                      onChange={value => setCommentSortBy(value as WorkCommentSortBy)}
                      options={[
                        { label: t('workData.comments.sortByTime'), value: 'time' },
                        { label: t('workData.comments.sortByLike'), value: 'like' },
                      ]}
                    />
                  </div>
                  <Card
                    size="small"
                    bodyStyle={{ padding: '0 18px' }}
                    style={{
                      borderRadius: 8,
                      borderColor: '#dbeafe',
                      boxShadow: '0 10px 28px rgba(22, 119, 255, 0.06)',
                    }}
                  >
                    {commentLoading ? (
                      <div style={{ display: 'grid', placeItems: 'center', minHeight: 260 }}>
                        <Spin />
                      </div>
                    ) : commentThreads.length > 0 ? (
                      <div>
                        <div style={{ padding: '14px 0', borderBottom: '1px solid #edf0f5' }}>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {t('workData.comments.threadSummary', {
                              roots: commentThreads.length,
                              total: commentTotal || comments.length,
                            })}
                          </Text>
                        </div>
                        {commentThreads.map(renderCommentThread)}
                      </div>
                    ) : (
                      <Empty description={t('workData.comments.empty')} style={{ padding: '56px 0' }} />
                    )}
                  </Card>
                </Space>
              ),
            },
            {
              key: 'snapshots',
              label: t('workData.tabs.snapshots'),
              children: (
                <Table
                  loading={snapshotLoading}
                  dataSource={snapshots}
                  columns={snapshotColumns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      )}
    </Drawer>
  )
}

export default PostDetailDrawer
