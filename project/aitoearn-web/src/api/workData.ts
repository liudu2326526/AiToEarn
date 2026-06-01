import http from '@/utils/request'
import type { AcquisitionDataSource, AcquisitionPlatform } from './acquisition'

export type MonitoredPostStatus = 'active' | 'paused' | 'failed' | 'archived' | 'published'
export type MonitoredPostFetchStatus = 'idle' | 'fetching' | 'ready' | 'failed' | 'permission_required' | 'not_configured' | 'pending_confirmation' | 'reviewing'

export interface MonitoredPostItem {
  id: string
  userId: string
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  postUrl: string
  title: string
  cover: string
  source: 'manual' | 'published_backfill' | 'demo_seed'
  monitorStatus: MonitoredPostStatus
  fetchStatus: MonitoredPostFetchStatus
  capabilityReason: string
  publishRecordId?: string
  publishTraceId?: string
  linkStatus?: string
  linkError?: string
  latestMetrics: Record<string, number>
  latestCommentCount: number
  lastFetchedAt?: string
  updatedAt?: string
}

export interface WorkDataListResponse {
  list: MonitoredPostItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface WorkCommentItem {
  id: string
  commentId: string
  parentCommentId: string
  userName: string
  userAvatar: string
  content: string
  likeCount: number
  ipLocation: string
  commentedAt?: string
  fetchBatch: string
  dataSource: AcquisitionDataSource | string
}

export type WorkCommentSortBy = 'time' | 'like'

export async function listMonitoredPosts(params: Record<string, string | number | undefined>) {
  const response = await http.get<WorkDataListResponse>('acquisition/work-data/monitored-posts', params)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'list monitored posts failed')
  return response.data
}

export async function createMonitoredPost(data: { platform: AcquisitionPlatform, accountId: string, postUrl: string, postId?: string }) {
  const response = await http.post<MonitoredPostItem>('acquisition/work-data/monitored-posts', data)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'create monitored post failed')
  return response.data
}

export async function fetchMonitoredPost(id: string) {
  const response = await http.post<MonitoredPostItem>(`acquisition/work-data/monitored-posts/${id}/fetch`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'fetch monitored post failed')
  return response.data
}

export async function updateMonitoredPostStatus(id: string, status: MonitoredPostStatus) {
  const response = await http.patch<MonitoredPostItem>(`acquisition/work-data/monitored-posts/${id}/status`, { status })
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'update monitored post status failed')
  return response.data
}

export async function deleteMonitoredPost(id: string) {
  const response = await http.delete<{ success: boolean }>(`acquisition/work-data/monitored-posts/${id}`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'delete monitored post failed')
  return response.data
}

export async function listMonitoredPostComments(id: string, params: Record<string, string | number | undefined>) {
  const response = await http.get<{ list: WorkCommentItem[], total: number, page: number, pageSize: number, totalPages: number }>(
    `acquisition/work-data/monitored-posts/${id}/comments`,
    params,
  )
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'list monitored post comments failed')
  return response.data
}

export interface WorkSnapshotItem {
  id: string
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  title: string
  cover: string
  metrics: {
    normalized: Record<string, number>
  }
  fetchedAt: string
  dataSource: string
}

export async function listMonitoredPostSnapshots(id: string, params: { limit?: number } = {}) {
  const response = await http.get<WorkSnapshotItem[]>(`acquisition/work-data/monitored-posts/${id}/snapshots`, params)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'list monitored post snapshots failed')
  return response.data
}
