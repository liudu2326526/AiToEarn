import http from '@/utils/request'

export type AcquisitionPlatform = 'xhs' | 'douyin' | 'kwai'

export type AcquisitionDataSource =
  | 'xhs_plugin_api'
  | 'xhs_bridge_capture'
  | 'douyin_open_api'
  | 'manual_snapshot'
  | 'demo_seed'

export interface AcquisitionFetchRequest {
  accountId: string
  platform: AcquisitionPlatform
  postUrl: string
  postId?: string
  cursor?: string
}

export interface AcquisitionFetchResponse {
  postSaved: boolean
  commentsSaved: number
  dataSource?: AcquisitionDataSource
  latestComments?: Array<{
    commentId: string
    content: string
    dataSource: AcquisitionDataSource | string
  }>
  capabilityStatus: string
  capabilityReason: string
  cursor: string
  hasMore: boolean
}

export async function fetchAcquisitionWork(data: AcquisitionFetchRequest) {
  const response = await http.post<AcquisitionFetchResponse>('acquisition/works/fetch', data)
  if (!response || response.code !== 0) {
    throw new Error(response?.message || 'fetch acquisition work failed')
  }
  return response.data
}
