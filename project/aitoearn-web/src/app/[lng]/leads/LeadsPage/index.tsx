'use client'

import type { LeadLabels, LeadPostOption } from '../components/types'
import type { AcquisitionPlatform } from '@/api/acquisition'
import type { DouyinCreatorPublishPrepareResult, LeadActivityItem, LeadItem, LeadReplyStyle, LeadReplyTaskItem, LeadSourceType, LeadStage, LeadStats, LeadStatus } from '@/api/leads'
import type { MonitoredPostItem } from '@/api/workData'
import { Alert, Button, Card, Form, Input, message, Modal, Radio, Select, Space, Typography } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import {
  addLeadNote,
  autoReplyLead,
  autoSelectLeadReplyStyle,
  batchAutoReplyLeads,
  batchUpdateLeadReplyStyle,
  cancelLeadReplyTask,
  generateLeadReplySuggestion,
  getLeadDetail,
  getLeadStats,
  getPrivateMessageCapability,
  importDouyinCreatorComments,
  importDouyinCreatorDms,
  listLeadReplyTasks,
  listLeads,
  listLeadTimeline,
  materializeLeads,
  prepareDouyinCreatorArticlePublishDryRun,
  prepareDouyinCreatorImageTextPublishDryRun,
  recordLeadReplyResult,
  replyDouyinCreatorComments,
  replyDouyinCreatorDms,
  retryLeadReplyTask,
  updateLeadReplyStyle,
  updateLeadStage,
} from '@/api/leads'
import { listMonitoredPosts } from '@/api/workData'
import { useTransClient } from '@/app/i18n/client'
import LeadDetailDrawer from '../components/LeadDetailDrawer'
import LeadTable from '../components/LeadTable'
import LeadToolbar from '../components/LeadToolbar'
import PrivateMessageStatusPanel from '../components/PrivateMessageStatusPanel'

const { Text, Title } = Typography
const { TextArea } = Input

type DouyinPublishMode = 'article' | 'imagetext'

interface DouyinPublishDryRunForm {
  mode: DouyinPublishMode
  title?: string
  subtitle?: string
  content?: string
  description?: string
  imagePath?: string
  imagePathsText?: string
  music?: string
  tagsText?: string
}

const emptyStats: LeadStats = {
  total: 0,
  pending: 0,
  in_progress: 0,
  converted: 0,
  lost: 0,
  invalid: 0,
}

const pageStyle: React.CSSProperties = {
  padding: '24px 28px 32px',
  background: 'linear-gradient(180deg, #f6f8fb 0, #ffffff 360px)',
  minHeight: '100vh',
}

const contentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 1480,
  margin: '0 auto',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
}

const statCardStyle: React.CSSProperties = {
  borderRadius: 8,
  borderColor: '#e8edf5',
  background: 'rgba(255, 255, 255, 0.82)',
  boxShadow: '0 10px 26px rgba(15, 23, 42, 0.04)',
}

const statValueStyle: React.CSSProperties = {
  marginTop: 4,
  color: '#111827',
  fontSize: 26,
  fontWeight: 800,
  lineHeight: 1.2,
  fontVariantNumeric: 'tabular-nums',
}

const LeadsPage: React.FC = () => {
  const { t } = useTransClient('route')
  const [loading, setLoading] = useState(false)
  const [materializing, setMaterializing] = useState(false)
  const [importingDouyinComments, setImportingDouyinComments] = useState(false)
  const [importingDouyinDms, setImportingDouyinDms] = useState(false)
  const [preparingDouyinPublish, setPreparingDouyinPublish] = useState(false)
  const [douyinPublishModalOpen, setDouyinPublishModalOpen] = useState(false)
  const [douyinPublishMode, setDouyinPublishMode] = useState<DouyinPublishMode>('imagetext')
  const [douyinPublishPrepareResult, setDouyinPublishPrepareResult] = useState<DouyinCreatorPublishPrepareResult | null>(null)
  const [douyinPublishForm] = Form.useForm<DouyinPublishDryRunForm>()
  const [autoSelecting, setAutoSelecting] = useState(false)
  const [autoReplying, setAutoReplying] = useState(false)
  const [batchAutoReplying, setBatchAutoReplying] = useState(false)
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [stats, setStats] = useState<LeadStats>(emptyStats)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [platform, setPlatform] = useState<AcquisitionPlatform | undefined>()
  const [stage, setStage] = useState<LeadStage | undefined>()
  const [status, setStatus] = useState<LeadStatus | undefined>()
  const [sourceType, setSourceType] = useState<LeadSourceType | undefined>()
  const [postId, setPostId] = useState<string | undefined>()
  const [postOptions, setPostOptions] = useState<LeadPostOption[]>([])
  const [keyword, setKeyword] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchReplyStyleOpen, setBatchReplyStyleOpen] = useState(false)
  const [batchReplyStyle, setBatchReplyStyle] = useState<LeadReplyStyle>('auto')
  const [batchReplyStyleSaving, setBatchReplyStyleSaving] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeLead, setActiveLead] = useState<LeadItem | null>(null)
  const [timeline, setTimeline] = useState<LeadActivityItem[]>([])
  const [replyTasks, setReplyTasks] = useState<LeadReplyTaskItem[]>([])
  const [capability, setCapability] = useState<Array<{
    platform: AcquisitionPlatform
    status: string
    reason: string
    metadata?: Record<string, unknown>
  }>>([])

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
    sourceType: {
      public_comment: t('leads.sourceType.public_comment'),
      private_message: t('leads.sourceType.private_message'),
      manual: t('leads.sourceType.manual'),
    },
    replyStyle: {
      auto: t('leads.replyStyle.auto'),
      friendly: t('operationStrategy.tone.friendly'),
      professional: t('operationStrategy.tone.professional'),
      promotion: t('operationStrategy.tone.promotion'),
      restrained: t('operationStrategy.tone.restrained'),
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
      'eyebrow': t('leads.eyebrow'),
      'title': t('leads.title'),
      'total': t('leads.stats.total'),
      'pending': t('leads.stats.pending'),
      'inProgress': t('leads.stats.inProgress'),
      'converted': t('leads.stats.converted'),
      'privateMessageStatus': t('leads.privateMessageStatus'),
      'platform': t('leads.filter.platform'),
      'stage': t('leads.filter.stage'),
      'status': t('leads.filter.status'),
      'sourceType': t('leads.filter.sourceType'),
      'post': t('leads.filter.post'),
      'searchPlaceholder': t('leads.filter.searchPlaceholder'),
      'refresh': t('leads.actions.refresh'),
      'materialize': t('leads.actions.materialize'),
      'importDouyinComments': t('leads.douyinCreator.importComments'),
      'importDouyinDms': t('leads.douyinCreator.importDms'),
      'prepareDouyinPublish': t('leads.douyinCreator.preparePublish'),
      'refreshDouyinStatus': t('leads.douyinCreator.refreshStatus'),
      'douyinCreatorStatusTitle': t('leads.douyinCreator.statusTitle'),
      'douyinCreatorToolsDir': t('leads.douyinCreator.toolsDir'),
      'douyinCreatorProfileDir': t('leads.douyinCreator.profileDir'),
      'douyinLocalAutomationNotice': t('leads.douyinCreator.localAutomationNotice'),
      'autoSelectReplyStyle': t('leads.actions.autoSelectReplyStyle'),
      'batchAutoReply': t('leads.actions.batchAutoReply'),
      'batchAssign': t('leads.actions.batchSetReplyStyle'),
      'platformAccount': t('leads.columns.platformAccount'),
      'sourcePost': t('leads.columns.sourcePost'),
      'sourceUser': t('leads.columns.sourceUser'),
      'commentContent': t('leads.columns.commentContent'),
      'stageStatus': t('leads.columns.stageStatus'),
      'replyStyle': t('leads.columns.replyStyle'),
      'lastFollowUp': t('leads.columns.lastFollowUp'),
      'actions': t('leads.columns.actions'),
      'unknownUser': t('leads.unknownUser'),
      'detail': t('leads.actions.detail'),
      'replyStyleUpdated': t('leads.replyStyle.updated'),
      'leadDetail': t('leads.detail.title'),
      'sourceComment': t('leads.detail.sourceComment'),
      'aiSuggestion': t('leads.detail.aiSuggestion'),
      'generate': t('leads.actions.generate'),
      'generateAndReply': t('leads.actions.generateAndReply'),
      'riskHits': t('leads.detail.riskHits'),
      'noSuggestion': t('leads.detail.noSuggestion'),
      'replyTasks': t('leads.detail.replyTasks'),
      'noReplyTasks': t('leads.detail.noReplyTasks'),
      'retryReplyTask': t('leads.actions.retryReplyTask'),
      'cancelReplyTask': t('leads.actions.cancelReplyTask'),
      'replyTaskScreenshot': t('leads.replyTask.screenshot'),
      'followUpActions': t('leads.detail.followUpActions'),
      'replyStyleField': t('leads.detail.replyStyle'),
      'recordReplied': t('leads.actions.recordReplied'),
      'addNote': t('leads.detail.addNote'),
      'timeline': t('leads.detail.timeline'),
      'noTimeline': t('leads.detail.noTimeline'),
      'batchAssignTitle': t('leads.batchReplyStyle.title'),
      'batchAssignFailed': t('leads.batchReplyStyle.failed'),
      'batchAssignSuccess': t('leads.batchReplyStyle.success'),
      'autoSelectSuccess': t('leads.autoSelectReplyStyle.success'),
      'autoSelectFailed': t('leads.autoSelectReplyStyle.failed'),
      'autoReplyQueued': t('leads.autoReply.queued'),
      'autoReplyFailed': t('leads.autoReply.failed'),
      'batchAutoReplyFailed': t('leads.autoReply.batchFailed'),
      'douyinDryRunReply': t('leads.douyinCreator.dryRunReply'),
      'douyinConfirmReply': t('leads.douyinCreator.confirmReply'),
      'douyinReplyDryRunQueued': t('leads.douyinCreator.replyDryRunQueued'),
      'douyinReplySendQueued': t('leads.douyinCreator.replySendQueued'),
      'douyinReplyFailed': t('leads.douyinCreator.replyFailed'),
      'douyinSelectPostFirst': t('leads.douyinCreator.selectPostFirst'),
      'douyinAccountRequired': t('leads.douyinCreator.accountRequired'),
      'douyinImportCommentsConfirm': t('leads.douyinCreator.importCommentsConfirm'),
      'douyinImportDmsConfirm': t('leads.douyinCreator.importDmsConfirm'),
      'douyinImportSuccess': t('leads.douyinCreator.importSuccess'),
      'douyinPublishPrepareTitle': t('leads.douyinCreator.publishPrepareTitle'),
      'douyinPublishPrepareNotice': t('leads.douyinCreator.publishPrepareNotice'),
      'douyinPublishMode': t('leads.douyinCreator.publishMode'),
      'douyinPublishModeArticle': t('leads.douyinCreator.publishModeArticle'),
      'douyinPublishModeImageText': t('leads.douyinCreator.publishModeImageText'),
      'douyinPublishArticleTitle': t('leads.douyinCreator.publishArticleTitle'),
      'douyinPublishSubtitle': t('leads.douyinCreator.publishSubtitle'),
      'douyinPublishContent': t('leads.douyinCreator.publishContent'),
      'douyinPublishImageTextTitle': t('leads.douyinCreator.publishImageTextTitle'),
      'douyinPublishDescription': t('leads.douyinCreator.publishDescription'),
      'douyinPublishCoverPath': t('leads.douyinCreator.publishCoverPath'),
      'douyinPublishImagePaths': t('leads.douyinCreator.publishImagePaths'),
      'douyinPublishMusic': t('leads.douyinCreator.publishMusic'),
      'douyinPublishTags': t('leads.douyinCreator.publishTags'),
      'douyinPublishPrepare': t('leads.douyinCreator.publishPrepare'),
      'douyinPublishPrepared': t('leads.douyinCreator.publishPrepared'),
      'douyinPublishPrepareFailed': t('leads.douyinCreator.publishPrepareFailed'),
      'douyinPublishCommand': t('leads.douyinCreator.publishCommand'),
      'douyinPublishInputPath': t('leads.douyinCreator.publishInputPath'),
      'copyCommand': t('leads.actions.copyCommand'),
      'copySuccess': t('leads.copySuccess'),
      'douyinConfirmSendTitle': t('leads.douyinCreator.confirmSendTitle'),
      'douyinConfirmSendContent': t('leads.douyinCreator.confirmSendContent'),
      'materializeSuccess': t('leads.materialize.success'),
      'materializeFailed': t('leads.materialize.failed'),
      'loadFailed': t('leads.loadFailed'),
      'detailLoadFailed': t('leads.detailLoadFailed'),
      'manualReplied': t('leads.manualReplied'),
      'activity.materialized': t('leads.activity.materialized'),
      'activity.assigned': t('leads.activity.assigned'),
      'activity.claimed': t('leads.activity.claimed'),
      'activity.transferred': t('leads.activity.transferred'),
      'activity.batch_assigned': t('leads.activity.batch_assigned'),
      'activity.reply_style_changed': t('leads.activity.reply_style_changed'),
      'activity.batch_reply_style_changed': t('leads.activity.batch_reply_style_changed'),
      'activity.auto_reply_style_selected': t('leads.activity.auto_reply_style_selected'),
      'activity.stage_changed': t('leads.activity.stage_changed'),
      'activity.note_added': t('leads.activity.note_added'),
      'activity.reply_suggested': t('leads.activity.reply_suggested'),
      'activity.reply_executed': t('leads.activity.reply_executed'),
      'activity.reply_failed': t('leads.activity.reply_failed'),
      'activity.reply_task_created': t('leads.activity.reply_task_created'),
      'activity.reply_task_queued': t('leads.activity.reply_task_queued'),
      'activity.reply_task_running': t('leads.activity.reply_task_running'),
      'activity.reply_task_human_required': t('leads.activity.reply_task_human_required'),
      'activity.reply_task_cancelled': t('leads.activity.reply_task_cancelled'),
      'activity.reply_task_retry_queued': t('leads.activity.reply_task_retry_queued'),
      'replyTask.status.pending': t('leads.replyTask.status.pending'),
      'replyTask.status.queued': t('leads.replyTask.status.queued'),
      'replyTask.status.running': t('leads.replyTask.status.running'),
      'replyTask.status.success': t('leads.replyTask.status.success'),
      'replyTask.status.failed': t('leads.replyTask.status.failed'),
      'replyTask.status.blocked': t('leads.replyTask.status.blocked'),
      'replyTask.status.human_required': t('leads.replyTask.status.human_required'),
      'replyTask.status.cancelled': t('leads.replyTask.status.cancelled'),
    },
  }), [t])

  const buildFilterParams = (overrides: { keyword?: string } = {}) => ({
    platform,
    stage,
    status,
    sourceType,
    postId,
    keyword: overrides.keyword ?? (keyword || undefined),
  })

  const selectedDouyinPost = useMemo(
    () => postOptions.find(option => option.value === postId && option.post.platform === 'douyin'),
    [postOptions, postId],
  )

  const douyinCapability = useMemo(
    () => capability.find(item => item.platform === 'douyin'),
    [capability],
  )

  const douyinCreatorConfigured = douyinCapability?.status === 'ready' || douyinCapability?.status === 'manual_required'

  const resolveDouyinAccountId = () => {
    const selectedLead = leads.find(lead => selectedRowKeys.includes(lead.id) && lead.platform === 'douyin')
    return selectedLead?.accountId
      || selectedDouyinPost?.post.accountId
      || leads.find(lead => lead.platform === 'douyin')?.accountId
      || ''
  }

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
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.loadFailed)
    }
    finally {
      setLoading(false)
    }
  }

  const fetchCapability = async () => {
    try {
      const data = await getPrivateMessageCapability()
      setCapability(data.list)
    }
    catch (error) {
      console.error(error)
    }
  }

  const fetchPostOptions = async () => {
    try {
      const data = await listMonitoredPosts({ page: 1, pageSize: 100 })
      setPostOptions(data.list.map((post: MonitoredPostItem) => ({
        value: post.postId,
        label: post.title || post.postId,
        post,
      })))
    }
    catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    fetchLeads(1, pageSize)
  }, [platform, stage, status, sourceType, postId])

  useEffect(() => {
    fetchCapability()
    fetchPostOptions()
  }, [])

  const openDetail = async (lead: LeadItem) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const [detail, logs, tasks] = await Promise.all([
        getLeadDetail(lead.id),
        listLeadTimeline(lead.id),
        listLeadReplyTasks(lead.id),
      ])
      setActiveLead(detail)
      setTimeline(logs)
      setReplyTasks(tasks.list)
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.detailLoadFailed)
    }
    finally {
      setDetailLoading(false)
    }
  }

  const runBatchAutoReply = async () => {
    setBatchAutoReplying(true)
    try {
      const result = await batchAutoReplyLeads({
        ...buildFilterParams(),
        onlyPending: true,
        limit: 20,
      })
      message.success(t('leads.autoReply.batchQueued', {
        matched: result.matched,
        queued: result.queued,
        blocked: result.blocked,
        failed: result.failed,
      }))
      await fetchLeads(1, pageSize)
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.batchAutoReplyFailed)
    }
    finally {
      setBatchAutoReplying(false)
    }
  }

  const refreshDetail = async () => {
    if (!activeLead)
      return
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
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.materializeFailed)
    }
    finally {
      setMaterializing(false)
    }
  }

  const runImportDouyinComments = () => {
    if (!selectedDouyinPost) {
      message.warning(labels.ui.douyinSelectPostFirst)
      return
    }

    Modal.confirm({
      title: labels.ui.importDouyinComments,
      content: labels.ui.douyinImportCommentsConfirm,
      onOk: async () => {
        setImportingDouyinComments(true)
        try {
          const result = await importDouyinCreatorComments({
            accountId: selectedDouyinPost.post.accountId,
            workTitle: selectedDouyinPost.post.title || selectedDouyinPost.post.postId,
            exportAll: false,
            limit: 500,
          })
          message.success(t('leads.douyinCreator.importSuccess', {
            imported: result.imported,
            materialized: result.materialized,
          }))
          await fetchLeads(1, pageSize)
        }
        catch (error) {
          message.error(error instanceof Error ? error.message : labels.ui.materializeFailed)
        }
        finally {
          setImportingDouyinComments(false)
        }
      },
    })
  }

  const runImportDouyinDms = () => {
    const accountId = resolveDouyinAccountId()
    if (!accountId) {
      message.warning(labels.ui.douyinAccountRequired)
      return
    }

    Modal.confirm({
      title: labels.ui.importDouyinDms,
      content: labels.ui.douyinImportDmsConfirm,
      onOk: async () => {
        setImportingDouyinDms(true)
        try {
          const result = await importDouyinCreatorDms({ accountId, limit: 50 })
          message.success(t('leads.douyinCreator.importSuccess', {
            imported: result.imported,
            materialized: result.materialized,
          }))
          await fetchLeads(1, pageSize)
          await fetchCapability()
        }
        catch (error) {
          message.error(error instanceof Error ? error.message : labels.ui.materializeFailed)
        }
        finally {
          setImportingDouyinDms(false)
        }
      },
    })
  }

  const openDouyinPublishDryRun = () => {
    setDouyinPublishPrepareResult(null)
    setDouyinPublishMode('imagetext')
    douyinPublishForm.setFieldsValue({ mode: 'imagetext' })
    setDouyinPublishModalOpen(true)
  }

  const prepareDouyinPublishDryRun = async (values: DouyinPublishDryRunForm) => {
    setPreparingDouyinPublish(true)
    try {
      const mode = values.mode || douyinPublishMode
      const result = mode === 'article'
        ? await prepareDouyinCreatorArticlePublishDryRun({
            title: String(values.title || '').trim(),
            subtitle: String(values.subtitle || '').trim(),
            content: String(values.content || '').trim(),
            imagePath: String(values.imagePath || '').trim(),
            music: String(values.music || '').trim(),
            tags: String(values.tagsText || '')
              .split(/[,，\n]/)
              .map(item => item.trim())
              .filter(Boolean)
              .slice(0, 5),
          })
        : await prepareDouyinCreatorImageTextPublishDryRun({
            title: String(values.title || '').trim(),
            description: String(values.description || '').trim(),
            imagePaths: String(values.imagePathsText || '')
              .split(/\n/)
              .map(item => item.trim())
              .filter(Boolean),
            music: String(values.music || '').trim(),
          })
      setDouyinPublishPrepareResult(result)
      message.success(labels.ui.douyinPublishPrepared)
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.douyinPublishPrepareFailed)
    }
    finally {
      setPreparingDouyinPublish(false)
    }
  }

  const copyDouyinPublishCommand = async () => {
    if (!douyinPublishPrepareResult?.commandText)
      return
    await navigator.clipboard.writeText(douyinPublishPrepareResult.commandText)
    message.success(labels.ui.copySuccess)
  }

  const runAutoSelectReplyStyle = async () => {
    setAutoSelecting(true)
    try {
      const result = await autoSelectLeadReplyStyle({
        ...buildFilterParams(),
        onlyAuto: true,
        limit: 100,
      })
      message.success(t('leads.autoSelectReplyStyle.success', {
        total: result.total,
        updated: result.updated,
        skipped: result.skipped,
      }))
      await fetchLeads(1, pageSize)
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.autoSelectFailed)
    }
    finally {
      setAutoSelecting(false)
    }
  }

  const openBatchAssign = () => {
    setBatchReplyStyle('auto')
    setBatchReplyStyleOpen(true)
  }

  const submitBatchAssign = async () => {
    setBatchReplyStyleSaving(true)
    try {
      const result = await batchUpdateLeadReplyStyle(selectedRowKeys.map(String), batchReplyStyle)
      message.success(t('leads.batchReplyStyle.success', { count: result.updated }))
      setSelectedRowKeys([])
      setBatchReplyStyleOpen(false)
      await fetchLeads()
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.batchAssignFailed)
    }
    finally {
      setBatchReplyStyleSaving(false)
    }
  }

  const createDouyinReplyTask = async (dryRun: boolean) => {
    if (!activeLead || activeLead.platform !== 'douyin')
      return
    setAutoReplying(true)
    try {
      const api = activeLead.sourceType === 'private_message'
        ? replyDouyinCreatorDms
        : replyDouyinCreatorComments
      await api({ leadIds: [activeLead.id], dryRun, limit: 1 })
      message.success(dryRun ? labels.ui.douyinReplyDryRunQueued : labels.ui.douyinReplySendQueued)
      await refreshDetail()
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : labels.ui.douyinReplyFailed)
    }
    finally {
      setAutoReplying(false)
    }
  }

  const confirmDouyinSend = async () => {
    Modal.confirm({
      title: labels.ui.douyinConfirmSendTitle,
      content: labels.ui.douyinConfirmSendContent,
      okButtonProps: { danger: true },
      onOk: async () => {
        await createDouyinReplyTask(false)
      },
    })
  }

  const statCards = [
    { key: 'total', label: labels.ui.total, value: stats.total },
    { key: 'pending', label: labels.ui.pending, value: stats.pending },
    { key: 'in_progress', label: labels.ui.inProgress, value: stats.in_progress },
    { key: 'converted', label: labels.ui.converted, value: stats.converted },
  ]

  return (
    <div style={pageStyle}>
      <Space direction="vertical" size={18} style={contentStyle}>
        <div style={headerStyle}>
          <div>
            <Text type="secondary">{labels.ui.eyebrow}</Text>
            <Title level={2} style={{ margin: '4px 0 0', lineHeight: 1.2 }}>{labels.ui.title}</Title>
          </div>
        </div>

        <div style={statsGridStyle}>
          {statCards.map(card => (
            <Card key={card.key} size="small" style={statCardStyle} styles={{ body: { padding: 14 } }}>
              <Text type="secondary">{card.label}</Text>
              <div style={statValueStyle}>{card.value}</div>
            </Card>
          ))}
        </div>

        <PrivateMessageStatusPanel capability={capability} labels={labels} />

        <LeadToolbar
          labels={labels}
          platform={platform}
          stage={stage}
          status={status}
          sourceType={sourceType}
          postId={postId}
          postOptions={postOptions}
          materializing={materializing}
          importingDouyinComments={importingDouyinComments}
          importingDouyinDms={importingDouyinDms}
          preparingDouyinPublish={preparingDouyinPublish}
          douyinCreatorConfigured={douyinCreatorConfigured}
          autoSelecting={autoSelecting}
          autoReplying={batchAutoReplying}
          hasSelection={selectedRowKeys.length > 0}
          onPlatformChange={setPlatform}
          onStageChange={setStage}
          onStatusChange={setStatus}
          onSourceTypeChange={setSourceType}
          onPostChange={setPostId}
          onSearch={(value) => { setKeyword(value); fetchLeads(1, pageSize, { keyword: value || undefined }) }}
          onRefresh={() => fetchLeads()}
          onMaterialize={runMaterialize}
          onImportDouyinComments={runImportDouyinComments}
          onImportDouyinDms={runImportDouyinDms}
          onPrepareDouyinPublish={openDouyinPublishDryRun}
          onRefreshDouyinStatus={fetchCapability}
          onAutoSelectReplyStyle={runAutoSelectReplyStyle}
          onBatchAutoReply={runBatchAutoReply}
          onBatchAssign={openBatchAssign}
        />

        <Card size="small" style={{ borderRadius: 8, borderColor: '#e8edf5' }} styles={{ body: { padding: 0 } }}>
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
        replyTasks={replyTasks}
        autoReplying={autoReplying}
        onClose={() => setDetailOpen(false)}
        onGenerateSuggestion={async () => {
          if (!activeLead)
            return
          await generateLeadReplySuggestion(activeLead.id)
          await refreshDetail()
        }}
        onAutoReply={async () => {
          if (!activeLead)
            return
          setAutoReplying(true)
          try {
            await autoReplyLead(activeLead.id, { regenerate: false })
            message.success(labels.ui.autoReplyQueued)
            await refreshDetail()
          }
          catch (error) {
            message.error(error instanceof Error ? error.message : labels.ui.autoReplyFailed)
          }
          finally {
            setAutoReplying(false)
          }
        }}
        onDouyinDryRunReply={async () => createDouyinReplyTask(true)}
        onDouyinConfirmReply={confirmDouyinSend}
        onCancelReplyTask={async (taskId) => {
          await cancelLeadReplyTask(taskId)
          await refreshDetail()
        }}
        onRetryReplyTask={async (taskId) => {
          await retryLeadReplyTask(taskId)
          message.success(labels.ui.autoReplyQueued)
          await refreshDetail()
        }}
        onUpdateStage={async (stage) => {
          if (!activeLead)
            return
          await updateLeadStage(activeLead.id, stage)
          await refreshDetail()
        }}
        onUpdateReplyStyle={async (replyStyle) => {
          if (!activeLead)
            return
          await updateLeadReplyStyle(activeLead.id, replyStyle)
          await refreshDetail()
        }}
        onRecordReplied={async () => {
          if (!activeLead)
            return
          await recordLeadReplyResult(activeLead.id, {
            replyContent: activeLead.suggestedReply?.content || labels.ui.manualReplied,
            status: 'success',
            executionMode: 'manual',
          })
          await refreshDetail()
        }}
        onAddNote={async (note) => {
          if (!activeLead)
            return
          await addLeadNote(activeLead.id, note)
          await refreshDetail()
        }}
      />

      <Modal
        title={labels.ui.douyinPublishPrepareTitle}
        open={douyinPublishModalOpen}
        footer={null}
        width={760}
        destroyOnClose
        onCancel={() => setDouyinPublishModalOpen(false)}
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Alert type="info" showIcon message={labels.ui.douyinPublishPrepareNotice} />
          <Form<DouyinPublishDryRunForm>
            form={douyinPublishForm}
            layout="vertical"
            initialValues={{ mode: 'imagetext' }}
            onFinish={prepareDouyinPublishDryRun}
          >
            <Form.Item name="mode" label={labels.ui.douyinPublishMode}>
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                onChange={(event) => {
                  setDouyinPublishMode(event.target.value)
                  setDouyinPublishPrepareResult(null)
                }}
                options={[
                  { value: 'imagetext', label: labels.ui.douyinPublishModeImageText },
                  { value: 'article', label: labels.ui.douyinPublishModeArticle },
                ]}
              />
            </Form.Item>

            {douyinPublishMode === 'article' ? (
              <>
                <Form.Item name="title" label={labels.ui.douyinPublishArticleTitle} rules={[{ required: true }]}>
                  <Input maxLength={30} />
                </Form.Item>
                <Form.Item name="subtitle" label={labels.ui.douyinPublishSubtitle}>
                  <Input maxLength={30} />
                </Form.Item>
                <Form.Item name="content" label={labels.ui.douyinPublishContent} rules={[{ required: true }]}>
                  <TextArea rows={5} maxLength={8000} showCount />
                </Form.Item>
                <Form.Item name="imagePath" label={labels.ui.douyinPublishCoverPath} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="tagsText" label={labels.ui.douyinPublishTags}>
                  <Input />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item name="title" label={labels.ui.douyinPublishImageTextTitle}>
                  <Input maxLength={20} />
                </Form.Item>
                <Form.Item name="description" label={labels.ui.douyinPublishDescription}>
                  <TextArea rows={4} maxLength={1000} showCount />
                </Form.Item>
                <Form.Item name="imagePathsText" label={labels.ui.douyinPublishImagePaths} rules={[{ required: true }]}>
                  <TextArea rows={4} />
                </Form.Item>
              </>
            )}

            <Form.Item name="music" label={labels.ui.douyinPublishMusic}>
              <Input />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={preparingDouyinPublish}>
              {labels.ui.douyinPublishPrepare}
            </Button>
          </Form>

          {douyinPublishPrepareResult ? (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text type="secondary">
                {labels.ui.douyinPublishInputPath}
                :
                {' '}
                {douyinPublishPrepareResult.inputPath}
              </Text>
              <Text strong>{labels.ui.douyinPublishCommand}</Text>
              <TextArea rows={3} value={douyinPublishPrepareResult.commandText} readOnly />
              <Button onClick={copyDouyinPublishCommand}>{labels.ui.copyCommand}</Button>
            </Space>
          ) : null}
        </Space>
      </Modal>

      <Modal
        title={labels.ui.batchAssignTitle}
        open={batchReplyStyleOpen}
        confirmLoading={batchReplyStyleSaving}
        onCancel={() => setBatchReplyStyleOpen(false)}
        onOk={submitBatchAssign}
      >
        <Select
          value={batchReplyStyle}
          style={{ width: '100%' }}
          onChange={value => setBatchReplyStyle(value)}
          options={Object.entries(labels.replyStyle).map(([value, label]) => ({ value, label }))}
        />
      </Modal>
    </div>
  )
}

export default LeadsPage
