import type { CommentItem } from '@/store/plugin/plats/types'

export function filterCommentsByKeyword(comments: CommentItem[], keyword: string): CommentItem[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase()

  if (!normalizedKeyword) {
    return comments
  }

  return comments.filter(comment => isCommentMatched(comment, normalizedKeyword))
}

function isCommentMatched(comment: CommentItem, keyword: string): boolean {
  const content = (comment.content || '').toLocaleLowerCase()
  const nickname = (comment.user?.nickname || '').toLocaleLowerCase()
  const userId = (comment.user?.id || '').toLocaleLowerCase()

  return content.includes(keyword)
    || nickname.includes(keyword)
    || userId.includes(keyword)
    || (comment.replies || []).some(reply => isCommentMatched(reply, keyword))
}
