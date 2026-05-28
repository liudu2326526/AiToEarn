import type {
  AcquisitionContent,
  AcquisitionContentStatus,
  AcquisitionPlatform,
  GenerateAcquisitionContentPayload,
} from '@/api/types/acquisitionContent'
import http from '@/utils/request'

export function apiGenerateAcquisitionContent(data: GenerateAcquisitionContentPayload) {
  return http.post<AcquisitionContent>('acquisition/content/generate', data)
}

export function apiListAcquisitionContent(params: {
  status?: AcquisitionContentStatus
  platform?: AcquisitionPlatform
  productCategory?: string
  page: number
  pageSize: number
}) {
  return http.get<{ list: AcquisitionContent[], total: number, page: number, pageSize: number }>('acquisition/content', params)
}

export function apiUpdateAcquisitionPlatformContent(id: string, data: {
  platform: AcquisitionPlatform
  title: string
  body: string
  topics: string[]
}) {
  return http.post<AcquisitionContent>(`acquisition/content/${id}/platform-content`, data)
}

export function apiReviewAcquisitionContent(id: string, data: { action: 'approve' | 'reject', note?: string }) {
  return http.post<AcquisitionContent>(`acquisition/content/${id}/review`, data)
}

export function apiScheduleAcquisitionContent(id: string, data: {
  publishAt: string
  accountMap: Record<AcquisitionPlatform, string>
}) {
  return http.post<AcquisitionContent>(`acquisition/content/${id}/schedule`, data)
}

export function apiCreateHookTemplate(data: {
  name: string
  content: string
  applicablePlatforms?: string[]
  applicableCategories?: string[]
}) {
  return http.post<any>('acquisition/strategy/hooks', data)
}

export function apiCreateScriptTemplate(data: {
  name: string
  content: string
  scene: string
  applicableCategories?: string[]
}) {
  return http.post<any>('acquisition/strategy/scripts', data)
}

export function apiUpsertAccountOpsConfig(accountId: string, data: any) {
  return http.post<any>(`acquisition/strategy/accounts/${accountId}/config`, data)
}
