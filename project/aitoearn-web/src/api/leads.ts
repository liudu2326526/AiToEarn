import type { AcquisitionPlatform } from './acquisition'
import http from '@/utils/request'

export type LeadStage = 'new_comment' | 'replied' | 'messaged' | 'wechat_guided' | 'wechat_added' | 'lost'
export type LeadStatus = 'pending' | 'in_progress' | 'converted' | 'lost' | 'invalid'
export type LeadSourceType = 'public_comment' | 'private_message' | 'manual'
export type LeadReplyStyle = 'auto' | 'friendly' | 'professional' | 'promotion' | 'restrained'
export type LeadReplyTaskStatus = 'pending' | 'queued' | 'running' | 'success' | 'failed' | 'blocked' | 'human_required' | 'cancelled'

export interface LeadItem {
  id: string
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  postTitle?: string
  postUrl?: string
  postCover?: string
  commentId: string
  parentCommentId: string
  userName: string
  userAvatar: string
  sourceContent: string
  sourceType?: LeadSourceType
  stage: LeadStage
  status: LeadStatus
  assignee: string
  replyStyle: LeadReplyStyle
  suggestedReply?: {
    content: string
    model: string
    status: 'empty' | 'generated' | 'blocked' | 'edited'
    riskHits: string[]
    generatedAt?: string
  }
  lastFollowUpAt?: string
  updatedAt?: string
}

export interface LeadActivityItem {
  id: string
  leadId: string
  action: string
  operatorId: string
  fromValue: string
  toValue: string
  note: string
  createdAt?: string
}

export interface LeadReplyTaskItem {
  id: string
  leadId: string
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  postUrl: string
  commentId: string
  replyContent: string
  replyStyle: LeadReplyStyle
  status: LeadReplyTaskStatus
  executorKind: 'browser_plugin' | 'douyin_creator_cli'
  targetType?: 'public_comment' | 'private_message'
  dryRun?: boolean
  attemptCount: number
  lastError?: string
  platformReplyId?: string
  screenshotUrl?: string
  startedAt?: string
  finishedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface LeadListResponse {
  list: LeadItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface LeadStats {
  total: number
  pending: number
  in_progress: number
  converted: number
  lost: number
  invalid: number
}

export interface AutoSelectLeadReplyStyleResult {
  total: number
  updated: number
  skipped: number
  styles: Record<Exclude<LeadReplyStyle, 'auto'>, number>
}

export async function listLeads(params: Record<string, string | number | undefined>) {
  const response = await http.get<LeadListResponse>('acquisition/leads', params)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'list leads failed')
  return response.data
}

export async function getLeadStats(params: Record<string, string | number | undefined>) {
  const response = await http.get<LeadStats>('acquisition/leads/stats', params)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'get lead stats failed')
  return response.data
}

export async function getLeadDetail(id: string) {
  const response = await http.get<LeadItem>(`acquisition/leads/${id}`)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'get lead detail failed')
  return response.data
}

export async function listLeadTimeline(id: string) {
  const response = await http.get<LeadActivityItem[]>(`acquisition/leads/${id}/timeline`)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'list lead timeline failed')
  return response.data
}

export async function materializeLeads(data: {
  monitoredPostId?: string
  platform?: AcquisitionPlatform
  accountId?: string
  postId?: string
  fetchBatch?: string
  postLimit?: number
  commentLimit?: number
  totalCommentLimit?: number
}) {
  const response = await http.post<{ totalScanned: number, materialized: number }>('acquisition/leads/materialize', data)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'materialize leads failed')
  return response.data
}

export async function claimLead(id: string) {
  const response = await http.post<LeadItem>(`acquisition/leads/${id}/claim`)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'claim lead failed')
  return response.data
}

export async function getPrivateMessageCapability(params: { platform?: AcquisitionPlatform, accountId?: string } = {}) {
  const response = await http.get<{
    list: Array<{
      platform: AcquisitionPlatform
      accountId?: string
      status: 'ready' | 'manual_required' | 'permission_required' | 'not_supported'
      reason: string
      metadata?: Record<string, unknown>
    }>
  }>('acquisition/leads/private-message/capability', params)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'get private message capability failed')
  return response.data
}

export interface DouyinCreatorAutomationStatus {
  configured: boolean
  toolsDir: string
  profileDir: string
  outputDir: string
  message: string
}

export interface DouyinCreatorImportResult {
  imported: number
  materialized: number
  resultPath: string
  warnings: string[]
}

export interface DouyinCreatorReplyTaskResult {
  dryRun: boolean
  matched: number
  queued: number
  blocked: number
  skipped: number
  failed: number
  taskIds: string[]
}

export interface DouyinCreatorPublishPrepareResult {
  mode: 'article_publish_prepare' | 'imagetext_publish_prepare'
  dryRun: true
  toolsDir: string
  profileDir: string
  inputPath: string
  command: string[]
  commandText: string
  message: string
}

export async function getDouyinCreatorStatus() {
  const response = await http.get<DouyinCreatorAutomationStatus>('acquisition/douyin-creator/status')
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'get douyin creator status failed')
  return response.data
}

export async function importDouyinCreatorComments(data: {
  accountId: string
  workTitle?: string
  exportAll?: boolean
  limit?: number
}) {
  const response = await http.post<DouyinCreatorImportResult>('acquisition/douyin-creator/comments/import', data)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'import douyin comments failed')
  return response.data
}

export async function importDouyinCreatorDms(data: { accountId: string, limit?: number }) {
  const response = await http.post<DouyinCreatorImportResult>('acquisition/douyin-creator/dms/import', data)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'import douyin dms failed')
  return response.data
}

export async function replyDouyinCreatorComments(data: {
  leadIds: string[]
  dryRun?: boolean
  limit?: number
}) {
  const response = await http.post<DouyinCreatorReplyTaskResult>('acquisition/douyin-creator/comments/reply', data)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'create douyin comment reply tasks failed')
  return response.data
}

export async function replyDouyinCreatorDms(data: {
  leadIds: string[]
  dryRun?: boolean
  limit?: number
}) {
  const response = await http.post<DouyinCreatorReplyTaskResult>('acquisition/douyin-creator/dms/reply', data)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'create douyin dm reply tasks failed')
  return response.data
}

export async function prepareDouyinCreatorArticlePublishDryRun(data: {
  title: string
  subtitle?: string
  content: string
  imagePath: string
  music?: string
  tags?: string[]
}) {
  const response = await http.post<DouyinCreatorPublishPrepareResult>('acquisition/douyin-creator/publish/article/dry-run', data)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'prepare douyin article publish dry-run failed')
  return response.data
}

export async function prepareDouyinCreatorImageTextPublishDryRun(data: {
  title?: string
  description?: string
  imagePaths: string[]
  music?: string
}) {
  const response = await http.post<DouyinCreatorPublishPrepareResult>('acquisition/douyin-creator/publish/imagetext/dry-run', data)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'prepare douyin image-text publish dry-run failed')
  return response.data
}

export async function updateLeadStage(id: string, stage: LeadStage) {
  const response = await http.patch<LeadItem>(`acquisition/leads/${id}/stage`, { stage })
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'update lead stage failed')
  return response.data
}

export async function updateLeadAssignee(id: string, assignee: string) {
  const response = await http.patch<LeadItem>(`acquisition/leads/${id}/assignee`, { assignee })
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'update lead assignee failed')
  return response.data
}

export async function batchAssignLeads(leadIds: string[], assignee: string) {
  const response = await http.patch<{ updated: number }>('acquisition/leads/batch-assignee', { leadIds, assignee })
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'batch assign leads failed')
  return response.data
}

export async function updateLeadReplyStyle(id: string, replyStyle: LeadReplyStyle) {
  const response = await http.patch<LeadItem>(`acquisition/leads/${id}/reply-style`, { replyStyle })
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'update lead reply style failed')
  return response.data
}

export async function batchUpdateLeadReplyStyle(leadIds: string[], replyStyle: LeadReplyStyle) {
  const response = await http.patch<{ updated: number }>('acquisition/leads/batch-reply-style', { leadIds, replyStyle })
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'batch update lead reply style failed')
  return response.data
}

export async function autoSelectLeadReplyStyle(params: Record<string, string | number | boolean | undefined>) {
  const response = await http.patch<AutoSelectLeadReplyStyleResult>('acquisition/leads/auto-reply-style', params)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'auto select lead reply style failed')
  return response.data
}

export async function autoReplyLead(id: string, data: { regenerate?: boolean, dryRun?: boolean, requireSuggestionReview?: boolean } = {}) {
  const response = await http.post<{ task: LeadReplyTaskItem | null, lead: LeadItem, dryRun?: boolean }>(`acquisition/leads/${id}/auto-reply`, data)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'auto reply lead failed')
  return response.data
}

export async function batchAutoReplyLeads(params: Record<string, string | number | boolean | undefined>) {
  const response = await http.post<{ matched: number, queued: number, blocked: number, skipped: number, failed: number, taskIds: string[] }>('acquisition/leads/auto-reply/batch', params)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'batch auto reply leads failed')
  return response.data
}

export async function listLeadReplyTasks(id: string) {
  const response = await http.get<{ list: LeadReplyTaskItem[], total: number }>(`acquisition/leads/${id}/reply-tasks`)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'list lead reply tasks failed')
  return response.data
}

export async function cancelLeadReplyTask(taskId: string) {
  const response = await http.post<LeadReplyTaskItem>(`acquisition/leads/reply-tasks/${taskId}/cancel`)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'cancel lead reply task failed')
  return response.data
}

export async function retryLeadReplyTask(taskId: string) {
  const response = await http.post<LeadReplyTaskItem>(`acquisition/leads/reply-tasks/${taskId}/retry`)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'retry lead reply task failed')
  return response.data
}

export async function generateLeadReplySuggestion(id: string) {
  const response = await http.post<LeadItem>(`acquisition/leads/${id}/reply-suggestion`)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'generate reply suggestion failed')
  return response.data
}

export async function addLeadNote(id: string, note: string) {
  const response = await http.post<LeadActivityItem>(`acquisition/leads/${id}/notes`, { note })
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'add lead note failed')
  return response.data
}

export async function recordLeadReplyResult(id: string, data: {
  replyContent: string
  status: 'success' | 'failed'
  executionMode?: 'manual' | 'platform_adapter'
  failureReason?: string
}) {
  const response = await http.post<LeadItem>(`acquisition/leads/${id}/reply-result`, data)
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || 'record lead reply result failed')
  return response.data
}
