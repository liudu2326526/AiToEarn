import http from '@/utils/request'
import type { AcquisitionPlatform } from './acquisition'

export type LeadStage = 'new_comment' | 'replied' | 'messaged' | 'wechat_guided' | 'wechat_added' | 'lost'
export type LeadStatus = 'pending' | 'in_progress' | 'converted' | 'lost' | 'invalid'

export interface LeadItem {
  id: string
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  commentId: string
  parentCommentId: string
  userName: string
  userAvatar: string
  sourceContent: string
  stage: LeadStage
  status: LeadStatus
  assignee: string
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

export async function listLeads(params: Record<string, string | number | undefined>) {
  const response = await http.get<LeadListResponse>('acquisition/leads', params)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'list leads failed')
  return response.data
}

export async function getLeadStats(params: Record<string, string | number | undefined>) {
  const response = await http.get<LeadStats>('acquisition/leads/stats', params)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'get lead stats failed')
  return response.data
}

export async function getLeadDetail(id: string) {
  const response = await http.get<LeadItem>(`acquisition/leads/${id}`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'get lead detail failed')
  return response.data
}

export async function listLeadTimeline(id: string) {
  const response = await http.get<LeadActivityItem[]>(`acquisition/leads/${id}/timeline`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'list lead timeline failed')
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
  const response = await http.post<{ totalScanned: number; materialized: number }>('acquisition/leads/materialize', data)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'materialize leads failed')
  return response.data
}

export async function claimLead(id: string) {
  const response = await http.post<LeadItem>(`acquisition/leads/${id}/claim`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'claim lead failed')
  return response.data
}

export async function getPrivateMessageCapability(params: { platform?: AcquisitionPlatform; accountId?: string } = {}) {
  const response = await http.get<{
    list: Array<{ platform: AcquisitionPlatform; accountId?: string; status: 'ready' | 'manual_required' | 'permission_required' | 'not_supported'; reason: string }>
  }>('acquisition/leads/private-message/capability', params)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'get private message capability failed')
  return response.data
}

export async function updateLeadStage(id: string, stage: LeadStage) {
  const response = await http.patch<LeadItem>(`acquisition/leads/${id}/stage`, { stage })
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'update lead stage failed')
  return response.data
}

export async function updateLeadAssignee(id: string, assignee: string) {
  const response = await http.patch<LeadItem>(`acquisition/leads/${id}/assignee`, { assignee })
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'update lead assignee failed')
  return response.data
}

export async function batchAssignLeads(leadIds: string[], assignee: string) {
  const response = await http.patch<{ updated: number }>('acquisition/leads/batch-assignee', { leadIds, assignee })
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'batch assign leads failed')
  return response.data
}

export async function generateLeadReplySuggestion(id: string) {
  const response = await http.post<LeadItem>(`acquisition/leads/${id}/reply-suggestion`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'generate reply suggestion failed')
  return response.data
}

export async function addLeadNote(id: string, note: string) {
  const response = await http.post<LeadActivityItem>(`acquisition/leads/${id}/notes`, { note })
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'add lead note failed')
  return response.data
}

export async function recordLeadReplyResult(id: string, data: {
  replyContent: string
  status: 'success' | 'failed'
  executionMode?: 'manual' | 'platform_adapter'
  failureReason?: string
}) {
  const response = await http.post<LeadItem>(`acquisition/leads/${id}/reply-result`, data)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'record lead reply result failed')
  return response.data
}
