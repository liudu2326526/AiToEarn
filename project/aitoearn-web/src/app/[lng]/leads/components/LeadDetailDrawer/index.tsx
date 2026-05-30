import type React from 'react'
import { Avatar, Button, Card, Drawer, Empty, Input, Select, Space, Tag, Timeline, Typography } from 'antd'
import { CheckCircleOutlined, MessageOutlined, RobotOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { LeadActivityItem, LeadItem } from '@/api/leads'
import type { LeadLabels } from '../types'

const { Text } = Typography

interface LeadDetailDrawerProps {
  labels: LeadLabels
  open: boolean
  loading: boolean
  activeLead: LeadItem | null
  timeline: LeadActivityItem[]
  onClose: () => void
  onGenerateSuggestion: () => Promise<void>
  onUpdateStage: (stage: LeadItem['stage']) => Promise<void>
  onUpdateAssignee: (assignee: string) => Promise<void>
  onRecordReplied: () => Promise<void>
  onAddNote: (note: string) => Promise<void>
}

const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  labels,
  open,
  loading,
  activeLead,
  timeline,
  onClose,
  onGenerateSuggestion,
  onUpdateStage,
  onUpdateAssignee,
  onRecordReplied,
  onAddNote,
}) => (
  <Drawer
    open={open}
    onClose={onClose}
    width={680}
    title={labels.ui.leadDetail}
    loading={loading}
  >
    {activeLead ? (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card size="small" title={labels.ui.sourceComment}>
          <Space direction="vertical" size={8}>
            <Space direction="vertical" size={2}>
              <Text type="secondary">{labels.ui.sourcePost}</Text>
              {activeLead.postUrl ? (
                <a href={activeLead.postUrl} target="_blank" rel="noreferrer">
                  {activeLead.postTitle || activeLead.postId}
                </a>
              ) : (
                <Text>{activeLead.postTitle || activeLead.postId}</Text>
              )}
            </Space>
            <Space>
              <Avatar src={activeLead.userAvatar}>{activeLead.userName?.slice(0, 1)}</Avatar>
              <Text strong>{activeLead.userName || labels.ui.unknownUser}</Text>
            </Space>
            <Text>{activeLead.sourceContent}</Text>
            <Space wrap>
              <Tag>{labels.platform[activeLead.platform]}</Tag>
              <Tag>{activeLead.postId}</Tag>
              <Tag>{activeLead.commentId}</Tag>
            </Space>
          </Space>
        </Card>

        <Card
          size="small"
          title={labels.ui.aiSuggestion}
          extra={<Button size="small" icon={<RobotOutlined />} onClick={onGenerateSuggestion}>{labels.ui.generate}</Button>}
        >
          {activeLead.suggestedReply?.content ? (
            <Space direction="vertical">
              <Text>{activeLead.suggestedReply.content}</Text>
              <Tag color={activeLead.suggestedReply.status === 'blocked' ? 'red' : 'green'}>{activeLead.suggestedReply.status}</Tag>
              {activeLead.suggestedReply.riskHits?.length > 0 && (
                <Text type="danger">{labels.ui.riskHits}: {activeLead.suggestedReply.riskHits.join(', ')}</Text>
              )}
            </Space>
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.ui.noSuggestion} />}
        </Card>

        <Card size="small" title={labels.ui.followUpActions}>
          <Space wrap>
            <Select
              value={activeLead.stage}
              style={{ width: 150 }}
              onChange={onUpdateStage}
              options={Object.entries(labels.stage).map(([value, label]) => ({ value, label }))}
            />
            <Input.Search
              placeholder={labels.ui.assigneeId}
              enterButton={labels.ui.assign}
              style={{ width: 240 }}
              onSearch={onUpdateAssignee}
            />
            <Button icon={<CheckCircleOutlined />} onClick={onRecordReplied}>{labels.ui.recordReplied}</Button>
          </Space>
          <Input.TextArea
            rows={3}
            placeholder={labels.ui.addNote}
            style={{ marginTop: 12 }}
            onPressEnter={async event => {
              const note = event.currentTarget.value.trim()
              if (!note) return
              await onAddNote(note)
              event.currentTarget.value = ''
            }}
          />
        </Card>

        <Card size="small" title={labels.ui.timeline}>
          {timeline.length > 0 ? (
            <Timeline
              items={timeline.map(item => ({
                dot: item.action.includes('reply') ? <MessageOutlined /> : undefined,
                children: (
                  <Space direction="vertical" size={2}>
                    <Text strong>{labels.ui[`activity.${item.action}`] || item.action}</Text>
                    <Text type="secondary">{item.note || `${item.fromValue || '-'} -> ${item.toValue || '-'}`}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : ''}</Text>
                  </Space>
                ),
              }))}
            />
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.ui.noTimeline} />}
        </Card>
      </Space>
    ) : null}
  </Drawer>
)

export default LeadDetailDrawer
