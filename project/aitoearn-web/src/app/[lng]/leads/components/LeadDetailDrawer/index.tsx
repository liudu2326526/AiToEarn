import type React from 'react'
import type { LeadLabels } from '../types'
import type { LeadActivityItem, LeadItem, LeadReplyStyle, LeadReplyTaskItem } from '@/api/leads'
import { CheckCircleOutlined, MessageOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons'
import { Avatar, Button, Card, Empty, Input, List, Select, Space, Spin, Tag, Timeline, Typography } from 'antd'
import dayjs from 'dayjs'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import ReplyTaskStatusTag from '../ReplyTaskStatusTag'

const { Text } = Typography

const detailCardStyle: React.CSSProperties = {
  borderColor: '#e8edf5',
  borderRadius: 8,
  background: 'rgba(255, 255, 255, 0.82)',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.06)',
}

const detailCardBodyStyle: React.CSSProperties = {
  padding: 14,
}

interface LeadDetailDrawerProps {
  labels: LeadLabels
  open: boolean
  loading: boolean
  activeLead: LeadItem | null
  timeline: LeadActivityItem[]
  replyTasks: LeadReplyTaskItem[]
  autoReplying: boolean
  onClose: () => void
  onGenerateSuggestion: () => Promise<void>
  onAutoReply: () => Promise<void>
  onDouyinDryRunReply: () => Promise<void>
  onDouyinConfirmReply: () => Promise<void>
  onCancelReplyTask: (taskId: string) => Promise<void>
  onRetryReplyTask: (taskId: string) => Promise<void>
  onUpdateStage: (stage: LeadItem['stage']) => Promise<void>
  onUpdateReplyStyle: (replyStyle: LeadReplyStyle) => Promise<void>
  onRecordReplied: () => Promise<void>
  onAddNote: (note: string) => Promise<void>
}

const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  labels,
  open,
  loading,
  activeLead,
  timeline,
  replyTasks,
  autoReplying,
  onClose,
  onGenerateSuggestion,
  onAutoReply,
  onDouyinDryRunReply,
  onDouyinConfirmReply,
  onCancelReplyTask,
  onRetryReplyTask,
  onUpdateStage,
  onUpdateReplyStyle,
  onRecordReplied,
  onAddNote,
}) => {
  if (!open)
    return null

  const postTitle = activeLead?.postTitle || activeLead?.postId
  const hasCompletedDouyinDryRun = Boolean(activeLead?.platform === 'douyin' && replyTasks.some(task =>
    task.executorKind === 'douyin_creator_cli'
    && task.dryRun
    && task.status === 'human_required'
    && task.lastError === 'dry_run_completed',
  ))

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen)
          onClose()
      }}
    >
      <DialogContent
        data-testid="lead-detail-dialog"
        className="max-h-[calc(100dvh-24px)] overflow-hidden border-white/70 bg-white/90 p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:max-w-[min(1080px,calc(100vw-48px))]"
      >
        <div className="flex max-h-[calc(100dvh-24px)] min-h-[560px] flex-col overflow-hidden">
          <div className="border-b border-slate-200/70 bg-white/65 px-5 py-4 pr-14">
            <DialogTitle className="text-lg font-semibold text-slate-950">
              {labels.ui.leadDetail}
            </DialogTitle>
            {activeLead ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>{activeLead.userName || labels.ui.unknownUser}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{labels.platform[activeLead.platform]}</span>
                {postTitle ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="max-w-[520px] truncate">{postTitle}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/65 p-4 sm:p-5">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <Spin />
              </div>
            ) : activeLead ? (
              <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-4">
                  <Card
                    size="small"
                    title={labels.ui.sourceComment}
                    style={detailCardStyle}
                    styles={{ body: detailCardBodyStyle }}
                  >
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <Text type="secondary">{labels.ui.sourcePost}</Text>
                        {activeLead.postUrl ? (
                          <a href={activeLead.postUrl} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-word' }}>
                            {postTitle}
                          </a>
                        ) : (
                          <Text style={{ wordBreak: 'break-word' }}>{postTitle}</Text>
                        )}
                      </Space>
                      <Space>
                        <Avatar src={activeLead.userAvatar}>{activeLead.userName?.slice(0, 1)}</Avatar>
                        <Text strong>{activeLead.userName || labels.ui.unknownUser}</Text>
                      </Space>
                      <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{activeLead.sourceContent}</Text>
                      <Space wrap>
                        <Tag>{labels.platform[activeLead.platform]}</Tag>
                        <Tag style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeLead.postId}</Tag>
                        <Tag style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeLead.commentId}</Tag>
                      </Space>
                    </Space>
                  </Card>

                  <Card
                    size="small"
                    title={labels.ui.aiSuggestion}
                    extra={(
                      <Space wrap>
                        <Button size="small" icon={<RobotOutlined />} onClick={onGenerateSuggestion}>{labels.ui.generate}</Button>
                        {activeLead.platform === 'douyin' ? (
                          <>
                            <Button size="small" type="primary" loading={autoReplying} onClick={onDouyinDryRunReply}>
                              {labels.ui.douyinDryRunReply}
                            </Button>
                            {hasCompletedDouyinDryRun ? (
                              <Button size="small" danger icon={<SendOutlined />} loading={autoReplying} onClick={onDouyinConfirmReply}>
                                {labels.ui.douyinConfirmReply}
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <Button size="small" type="primary" loading={autoReplying} onClick={onAutoReply}>{labels.ui.generateAndReply}</Button>
                        )}
                      </Space>
                    )}
                    style={detailCardStyle}
                    styles={{ body: detailCardBodyStyle }}
                  >
                    {activeLead.suggestedReply?.content ? (
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{activeLead.suggestedReply.content}</Text>
                        <Tag color={activeLead.suggestedReply.status === 'blocked' ? 'red' : 'green'}>{activeLead.suggestedReply.status}</Tag>
                        {activeLead.suggestedReply.riskHits?.length > 0 && (
                          <Text type="danger" style={{ wordBreak: 'break-word' }}>
                            {labels.ui.riskHits}
                            :
                            {' '}
                            {activeLead.suggestedReply.riskHits.join(', ')}
                          </Text>
                        )}
                      </Space>
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.ui.noSuggestion} />}
                  </Card>

                  <Card
                    size="small"
                    title={labels.ui.followUpActions}
                    style={detailCardStyle}
                    styles={{ body: detailCardBodyStyle }}
                  >
                    <Space wrap>
                      <Select
                        value={activeLead.stage}
                        style={{ width: 150 }}
                        onChange={onUpdateStage}
                        options={Object.entries(labels.stage).map(([value, label]) => ({ value, label }))}
                      />
                      <Select
                        value={activeLead.replyStyle || 'auto'}
                        style={{ width: 220 }}
                        onChange={onUpdateReplyStyle}
                        options={Object.entries(labels.replyStyle).map(([value, label]) => ({ value, label }))}
                        placeholder={labels.ui.replyStyleField}
                      />
                      <Button icon={<CheckCircleOutlined />} onClick={onRecordReplied}>{labels.ui.recordReplied}</Button>
                    </Space>
                    <Input.TextArea
                      rows={3}
                      placeholder={labels.ui.addNote}
                      style={{ marginTop: 12 }}
                      onPressEnter={async (event) => {
                        const note = event.currentTarget.value.trim()
                        if (!note)
                          return
                        await onAddNote(note)
                        event.currentTarget.value = ''
                      }}
                    />
                  </Card>
                </div>

                <div className="min-w-0 space-y-4">
                  <Card
                    size="small"
                    title={labels.ui.replyTasks}
                    style={detailCardStyle}
                    styles={{ body: detailCardBodyStyle }}
                  >
                    {replyTasks.length > 0 ? (
                      <List
                        size="small"
                        dataSource={replyTasks}
                        renderItem={task => (
                          <List.Item
                            actions={[
                              ['failed', 'human_required'].includes(task.status) ? (
                                <Button key="retry" size="small" onClick={() => onRetryReplyTask(task.id)}>{labels.ui.retryReplyTask}</Button>
                              ) : null,
                              ['pending', 'queued'].includes(task.status) ? (
                                <Button key="cancel" size="small" onClick={() => onCancelReplyTask(task.id)}>{labels.ui.cancelReplyTask}</Button>
                              ) : null,
                            ].filter(Boolean)}
                          >
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <Space wrap>
                                <ReplyTaskStatusTag status={task.status} label={labels.ui[`replyTask.status.${task.status}`] || task.status} />
                                <Text type="secondary">{task.createdAt ? dayjs(task.createdAt).format('MM-DD HH:mm') : ''}</Text>
                              </Space>
                              <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{task.replyContent}</Text>
                              {task.lastError ? <Text type="danger" style={{ wordBreak: 'break-word' }}>{task.lastError}</Text> : null}
                              {task.screenshotUrl ? <a href={task.screenshotUrl} target="_blank" rel="noreferrer">{labels.ui.replyTaskScreenshot}</a> : null}
                            </Space>
                          </List.Item>
                        )}
                      />
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.ui.noReplyTasks} />}
                  </Card>

                  <Card
                    size="small"
                    title={labels.ui.timeline}
                    style={detailCardStyle}
                    styles={{ body: { ...detailCardBodyStyle, paddingBottom: 2 } }}
                  >
                    {timeline.length > 0 ? (
                      <Timeline
                        items={timeline.map(item => ({
                          dot: item.action.includes('reply') ? <MessageOutlined /> : undefined,
                          children: (
                            <Space direction="vertical" size={2}>
                              <Text strong>{labels.ui[`activity.${item.action}`] || item.action}</Text>
                              <Text type="secondary" style={{ wordBreak: 'break-word' }}>{item.note || `${item.fromValue || '-'} -> ${item.toValue || '-'}`}</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>{item.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : ''}</Text>
                            </Space>
                          ),
                        }))}
                      />
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.ui.noTimeline} />}
                  </Card>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LeadDetailDrawer
