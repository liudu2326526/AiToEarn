import type {
  PromotionApplication,
  PromotionGoldSummary,
  PromotionLedgerItem,
  PromotionTask,
  PromotionTaskListParams,
  PromotionTaskListResponse,
} from '@/api/types/promotion'
import http from '@/utils/request'

export function apiListPromotionTasks(params: PromotionTaskListParams) {
  return http.get<PromotionTaskListResponse>('promotion/creator/tasks', params)
}

export function apiGetPromotionTask(id: string) {
  return http.get<PromotionTask>(`promotion/creator/tasks/${id}`)
}

export function apiAcceptPromotionTask(id: string, data: { accountId?: string }) {
  return http.post<PromotionApplication>(`promotion/creator/tasks/${id}/accept`, data)
}

export function apiListCreatorPromotionApplications(params: { page?: number, pageSize?: number }) {
  return http.get<{ list: PromotionApplication[], total: number }>('promotion/creator/applications', params)
}

export function apiSubmitPromotionWork(id: string, data: { workLink: string, publishRecordId?: string }) {
  return http.post<PromotionApplication>(`promotion/creator/applications/${id}/submit`, data)
}

export function apiListAdvertiserPromotionTasks(params: { page?: number, pageSize?: number }) {
  return http.get<PromotionTaskListResponse>('promotion/advertiser/tasks', params)
}

export function apiCreateAdvertiserPromotionTask(data: Partial<PromotionTask>) {
  return http.post<PromotionTask>('promotion/advertiser/tasks', data)
}

export function apiUpdateAdvertiserPromotionTask(id: string, data: Partial<PromotionTask>) {
  return http.patch<PromotionTask>(`promotion/advertiser/tasks/${id}`, data)
}

export function apiReviewPromotionSubmission(id: string, data: { approved: boolean, reason?: string }) {
  return http.post<PromotionApplication>(`promotion/advertiser/applications/${id}/review`, data)
}

export function apiGetPromotionGoldSummary() {
  return http.get<PromotionGoldSummary>('promotion/gold/summary')
}

export function apiListPromotionLedger(params: { page?: number, pageSize?: number }) {
  return http.get<{ list: PromotionLedgerItem[], total: number }>('promotion/gold/ledger', params)
}
