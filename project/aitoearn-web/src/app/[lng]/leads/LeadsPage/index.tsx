'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, Input, Modal, Space, Typography, message } from 'antd'
import type { AcquisitionPlatform } from '@/api/acquisition'
import type { LeadActivityItem, LeadItem, LeadStage, LeadStats, LeadStatus } from '@/api/leads'
import {
  addLeadNote,
  batchAssignLeads,
  generateLeadReplySuggestion,
  getLeadDetail,
  getLeadStats,
  getPrivateMessageCapability,
  listLeadTimeline,
  listLeads,
  materializeLeads,
  recordLeadReplyResult,
  updateLeadAssignee,
  updateLeadStage,
} from '@/api/leads'
import { useTransClient } from '@/app/i18n/client'
import LeadDetailDrawer from '../components/LeadDetailDrawer'
import LeadTable from '../components/LeadTable'
import LeadToolbar from '../components/LeadToolbar'
import PrivateMessageStatusPanel from '../components/PrivateMessageStatusPanel'
import type { LeadLabels } from '../components/types'

const { Text, Title } = Typography

const emptyStats: LeadStats = {
  total: 0,
  pending: 0,
  in_progress: 0,
  converted: 0,
  lost: 0,
  invalid: 0,
}

const LeadsPage: React.FC = () => {
  const { t } = useTransClient('route')
  const [loading, setLoading] = useState(false)
  const [materializing, setMaterializing] = useState(false)
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [stats, setStats] = useState<LeadStats>(emptyStats)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [platform, setPlatform] = useState<AcquisitionPlatform | undefined>()
  const [stage, setStage] = useState<LeadStage | undefined>()
  const [status, setStatus] = useState<LeadStatus | undefined>()
  const [keyword, setKeyword] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchAssigneeOpen, setBatchAssigneeOpen] = useState(false)
  const [batchAssignee, setBatchAssignee] = useState('')
  const [batchAssigning, setBatchAssigning] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeLead, setActiveLead] = useState<LeadItem | null>(null)
  const [timeline, setTimeline] = useState<LeadActivityItem[]>([])
  const [capability, setCapability] = useState<Array<{ platform: AcquisitionPlatform; status: string; reason: string }>>([])

  const labels = useMemo<LeadLabels>(() => ({
    stage: {
      new_comment: t('leads.stage.new_comment'),
      replied: t('leads.stage.replied'),
      messaged: t('leads.stage.messaged'),
      wechat_guided: t('leads.stage.wechat_guided'),
      wechat_added: t('leads.stage.wechat_added'),
      lost: t('leads.stage.lost'),
    },
    status: {
      pending: t('leads.status.pending'),
      in_progress: t('leads.status.in_progress'),
      converted: t('leads.status.converted'),
      lost: t('leads.status.lost'),
      invalid: t('leads.status.invalid'),
    },
    platform: {
      xhs: t('acquisition.platform.xhs'),
      douyin: t('acquisition.platform.douyin'),
      kwai: t('acquisition.platform.kwai'),
    },
    capabilityStatus: {
      ready: t('leads.capability.ready'),
      manual_required: t('leads.capability.manual_required'),
      permission_required: t('leads.capability.permission_required'),
      not_supported: t('leads.capability.not_supported'),
    },
    ui: {
      eyebrow: t('leads.eyebrow'),
      title: t('leads.title'),
      total: t('leads.stats.total'),
      pending: t('leads.stats.pending'),
      inProgress: t('leads.stats.inProgress'),
      converted: t('leads.stats.converted'),
      privateMessageStatus: t('leads.privateMessageStatus'),
      platform: t('leads.filter.platform'),
      stage: t('leads.filter.stage'),
      status: t('leads.filter.status'),
      searchPlaceholder: t('leads.filter.searchPlaceholder'),
      refresh: t('leads.actions.refresh'),
      materialize: t('leads.actions.materialize'),
      batchAssign: t('leads.actions.batchAssign'),
      platformAccount: t('leads.columns.platformAccount'),
      sourceUser: t('leads.columns.sourceUser'),
      commentContent: t('leads.columns.commentContent'),
      stageStatus: t('leads.columns.stageStatus'),
      assignee: t('leads.columns.assignee'),
      lastFollowUp: t('leads.columns.lastFollowUp'),
      actions: t('leads.columns.actions'),
      unknownUser: t('leads.unknownUser'),
      unassigned: t('leads.unassigned'),
      detail: t('leads.actions.detail'),
      claim: t('leads.actions.claim'),
      claimSuccess: t('leads.claimSuccess'),
      leadDetail: t('leads.detail.title'),
      sourceComment: t('leads.detail.sourceComment'),
      aiSuggestion: t('leads.detail.aiSuggestion'),
      generate: t('leads.actions.generate'),
      riskHits: t('leads.detail.riskHits'),
      noSuggestion: t('leads.detail.noSuggestion'),
      followUpActions: t('leads.detail.followUpActions'),
      assigneeId: t('leads.detail.assigneeId'),
      assign: t('leads.actions.assign'),
      recordReplied: t('leads.actions.recordReplied'),
      addNote: t('leads.detail.addNote'),
      timeline: t('leads.detail.timeline'),
      noTimeline: t('leads.detail.noTimeline'),
      batchAssignTitle: t('leads.batchAssign.title'),
      batchAssigneePlaceholder: t('leads.batchAssign.placeholder'),
      batchAssignFailed: t('leads.batchAssign.failed'),
      batchAssignSuccess: t('leads.batchAssign.success'),
      materializeSuccess: t('leads.materialize.success'),
      materializeFailed: t('leads.materialize.failed'),
      loadFailed: t('leads.loadFailed'),
      detailLoadFailed: t('leads.detailLoadFailed'),
      manualReplied: t('leads.manualReplied'),
      'activity.materialized': t('leads.activity.materialized'),
      'activity.assigned': t('leads.activity.assigned'),
      'activity.claimed': t('leads.activity.claimed'),
      'activity.transferred': t('leads.activity.transferred'),
      'activity.batch_assigned': t('leads.activity.batch_assigned'),
      'activity.stage_changed': t('leads.activity.stage_changed'),
      'activity.note_added': t('leads.activity.note_added'),
      'activity.reply_suggested': t('leads.activity.reply_suggested'),
      'activity.reply_executed': t('leads.activity.reply_executed'),
      'activity.reply_failed': t('leads.activity.reply_failed'),
    },
  }), [t])

  const buildFilterParams = (overrides: { keyword?: string } = {}) => ({
    platform,
    stage,
    status,
    keyword: overrides.keyword ?? (keyword || undefined),
  })

  const fetchStats = async (overrides: { keyword?: string } = {}) => {
    const data = await getLeadStats(buildFilterParams(overrides))
    setStats(data)
  }

  const fetchLeads = async (
    nextPage = page,
    nextPageSize = pageSize,
    overrides: { keyword?: string } = {},
  ) => {
    setLoading(true)
    try {
      const params = buildFilterParams(overrides)
      const [listData] = await Promise.all([
        listLeads({
          ...params,
          page: nextPage,
          pageSize: nextPageSize,
        }),
        fetchStats(overrides),
      ])
      setLeads(listData.list)
      setTotal(listData.total)
      setPage(listData.page)
      setPageSize(listData.pageSize)
    } catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.loadFailed)
    } finally {
      setLoading(false)
    }
  }

  const fetchCapability = async () => {
    try {
      const data = await getPrivateMessageCapability()
      setCapability(data.list)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    fetchLeads(1, pageSize)
  }, [platform, stage, status])

  useEffect(() => {
    fetchCapability()
  }, [])

  const openDetail = async (lead: LeadItem) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const [detail, logs] = await Promise.all([
        getLeadDetail(lead.id),
        listLeadTimeline(lead.id),
      ])
      setActiveLead(detail)
      setTimeline(logs)
    } catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.detailLoadFailed)
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshDetail = async () => {
    if (!activeLead) return
    await openDetail(activeLead)
    await fetchLeads()
  }

  const runMaterialize = async () => {
    setMaterializing(true)
    try {
      const result = await materializeLeads({ postLimit: 20, commentLimit: 100, totalCommentLimit: 100 })
      message.success(t('leads.materialize.success', {
        total: result.totalScanned,
        materialized: result.materialized,
      }))
      await fetchLeads(1, pageSize)
    } catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.materializeFailed)
    } finally {
      setMaterializing(false)
    }
  }

  const openBatchAssign = () => {
    setBatchAssignee('')
    setBatchAssigneeOpen(true)
  }

  const submitBatchAssign = async () => {
    setBatchAssigning(true)
    try {
      const result = await batchAssignLeads(selectedRowKeys.map(String), batchAssignee.trim())
      message.success(t('leads.batchAssign.success', { count: result.updated }))
      setSelectedRowKeys([])
      setBatchAssigneeOpen(false)
      await fetchLeads()
    } catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.batchAssignFailed)
    } finally {
      setBatchAssigning(false)
    }
  }

  const statCards = [
    { key: 'total', label: labels.ui.total, value: stats.total },
    { key: 'pending', label: labels.ui.pending, value: stats.pending },
    { key: 'in_progress', label: labels.ui.inProgress, value: stats.in_progress },
    { key: 'converted', label: labels.ui.converted, value: stats.converted },
  ]

  return (
    <div style={{ padding: 24, background: '#f6f8fb', minHeight: '100vh' }}>
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <div>
          <Text type="secondary">{labels.ui.eyebrow}</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>{labels.ui.title}</Title>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: 12 }}>
          {statCards.map(card => (
            <Card key={card.key} size="small">
              <Text type="secondary">{card.label}</Text>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{card.value}</div>
            </Card>
          ))}
        </div>

        <PrivateMessageStatusPanel capability={capability} labels={labels} />

        <LeadToolbar
          labels={labels}
          platform={platform}
          stage={stage}
          status={status}
          materializing={materializing}
          hasSelection={selectedRowKeys.length > 0}
          onPlatformChange={setPlatform}
          onStageChange={setStage}
          onStatusChange={setStatus}
          onSearch={value => { setKeyword(value); fetchLeads(1, pageSize, { keyword: value || undefined }) }}
          onRefresh={() => fetchLeads()}
          onMaterialize={runMaterialize}
          onBatchAssign={openBatchAssign}
        />

        <Card size="small" style={{ borderRadius: 8 }}>
          <LeadTable
            labels={labels}
            leads={leads}
            loading={loading}
            page={page}
            pageSize={pageSize}
            total={total}
            selectedRowKeys={selectedRowKeys}
            onSelectionChange={setSelectedRowKeys}
            onPageChange={fetchLeads}
            onOpenDetail={openDetail}
            onRefresh={() => fetchLeads()}
          />
        </Card>
      </Space>

      <LeadDetailDrawer
        labels={labels}
        open={detailOpen}
        loading={detailLoading}
        activeLead={activeLead}
        timeline={timeline}
        onClose={() => setDetailOpen(false)}
        onGenerateSuggestion={async () => {
          if (!activeLead) return
          await generateLeadReplySuggestion(activeLead.id)
          await refreshDetail()
        }}
        onUpdateStage={async stage => {
          if (!activeLead) return
          await updateLeadStage(activeLead.id, stage)
          await refreshDetail()
        }}
        onUpdateAssignee={async assignee => {
          if (!activeLead) return
          await updateLeadAssignee(activeLead.id, assignee)
          await refreshDetail()
        }}
        onRecordReplied={async () => {
          if (!activeLead) return
          await recordLeadReplyResult(activeLead.id, {
            replyContent: activeLead.suggestedReply?.content || labels.ui.manualReplied,
            status: 'success',
            executionMode: 'manual',
          })
          await refreshDetail()
        }}
        onAddNote={async note => {
          if (!activeLead) return
          await addLeadNote(activeLead.id, note)
          await refreshDetail()
        }}
      />

      <Modal
        title={labels.ui.batchAssignTitle}
        open={batchAssigneeOpen}
        confirmLoading={batchAssigning}
        onCancel={() => setBatchAssigneeOpen(false)}
        onOk={submitBatchAssign}
      >
        <Input
          value={batchAssignee}
          placeholder={labels.ui.batchAssigneePlaceholder}
          onChange={event => setBatchAssignee(event.target.value)}
          onPressEnter={submitBatchAssign}
        />
      </Modal>
    </div>
  )
}

export default LeadsPage
