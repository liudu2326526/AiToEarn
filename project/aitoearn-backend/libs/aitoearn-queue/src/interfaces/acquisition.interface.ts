export interface AcquisitionCommentFetchData {
  userId: string
  accountId: string
  platform: string
  postId?: string
  postUrl: string
  cursor?: string
  fetchBatch: string
}

export interface AcquisitionPostBackfillData {
  userId: string
  accountId: string
  platform: string
  postId?: string
  postUrl: string
  authorUserId?: string
  xsecToken?: string
  xsecSource?: string
}

export interface AcquisitionLeadNotifyData {
  leadId: string
  operatorId?: string
  reason: 'created' | 'assigned' | 'stage_changed' | 'timeout'
}

export interface AcquisitionSensitiveCheckData {
  accountId?: string
  text: string
  context: 'public_comment' | 'private_message' | 'hook_template' | 'script_template'
}

export interface AcquisitionLeadReplyTaskData {
  taskId: string
}
