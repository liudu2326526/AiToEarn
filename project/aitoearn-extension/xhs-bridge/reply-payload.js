export function validateReplyParams(params = {}) {
  const noteId = String(params.noteId || '').trim()
  const postUrl = String(params.postUrl || '').trim()
  const commentId = String(params.commentId || '').trim()
  const content = String(params.content || '').trim()

  if (!noteId) throw new Error('noteId 不能为空')
  if (!postUrl) throw new Error('postUrl 不能为空')
  if (!postUrl.startsWith('https://www.xiaohongshu.com/')) throw new Error('postUrl 必须是小红书链接')
  if (!commentId) throw new Error('commentId 不能为空')
  if (!content) throw new Error('回复内容不能为空')
  if (content.length > 1000) throw new Error('回复内容不能超过 1000 字')

  return {
    noteId,
    postUrl,
    commentId,
    content,
    visibleTab: params.visibleTab !== false,
    screenshotPolicy: ['never', 'failure', 'always'].includes(params.screenshotPolicy)
      ? params.screenshotPolicy
      : 'failure',
  }
}

export function buildXhsReplyBody(params) {
  return {
    note_id: params.noteId,
    content: params.content,
    at_users: [],
    target_comment_id: params.commentId,
  }
}

export function buildXhsDomReplyTarget(params) {
  const commentId = String(params.commentId || '').trim()
  const content = String(params.content || '').trim()
  const escapedCommentId = escapeCssAttributeValue(commentId)

  return {
    commentId,
    content,
    selectors: [
      `[data-comment-id="${escapedCommentId}"]`,
      `[id="comment-${escapedCommentId}"]`,
    ],
  }
}

export function normalizeXhsReplyResponse(response) {
  const success = Boolean(response?.success || response?.code === 0 || response?.code === '0')
  const replyId = response?.data?.comment?.id || response?.data?.id || ''
  const message = response?.msg || response?.message || (success ? '评论回复已发布' : '发布评论失败')
  const signatureRejected = !success && /x-s|x-t|signature|签名|461|406/i.test(String(response?.msg || response?.message || response?.code || ''))

  return {
    success,
    replyId,
    message,
    // Log hint only. Do not branch final task status on this flag because
    // platform messages can be ambiguous.
    signatureRejected,
    rawData: response,
  }
}

export function normalizeXhsDomReplyResponse(response) {
  const success = Boolean(response?.success)
  const replyId = response?.replyId || ''
  const message = response?.message || (success ? 'DOM 自动化回复已发布' : 'DOM 自动化回复失败')

  return {
    success,
    replyId,
    message,
    signatureRejected: false,
    rawData: response,
  }
}

function escapeCssAttributeValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
