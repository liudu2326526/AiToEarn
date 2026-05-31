import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildXhsDomReplyTarget,
  buildXhsReplyBody,
  normalizeXhsDomReplyResponse,
  normalizeXhsReplyResponse,
  validateReplyParams,
} from '../reply-payload.js'

test('validateReplyParams trims and normalizes params', () => {
  const params = validateReplyParams({
    noteId: ' note-1 ',
    postUrl: ' https://www.xiaohongshu.com/explore/note-1?xsec_token=abc ',
    commentId: ' comment-1 ',
    content: '  好的  ',
  })

  assert.deepEqual(params, {
    noteId: 'note-1',
    postUrl: 'https://www.xiaohongshu.com/explore/note-1?xsec_token=abc',
    commentId: 'comment-1',
    content: '好的',
    visibleTab: true,
    screenshotPolicy: 'failure',
  })
})

test('validateReplyParams rejects missing identifiers', () => {
  assert.throws(() => validateReplyParams({
    postUrl: 'https://www.xiaohongshu.com/explore/n',
    commentId: 'c',
    content: 'hello',
  }), /noteId/)
  assert.throws(() => validateReplyParams({
    noteId: 'n',
    commentId: 'c',
    content: 'hello',
  }), /postUrl/)
  assert.throws(() => validateReplyParams({
    noteId: 'n',
    postUrl: 'https://example.com/n',
    commentId: 'c',
    content: 'hello',
  }), /小红书链接/)
  assert.throws(() => validateReplyParams({
    noteId: 'n',
    postUrl: 'https://www.xiaohongshu.com/explore/n',
    content: 'hello',
  }), /commentId/)
})

test('validateReplyParams normalizes screenshot policy and visibility', () => {
  assert.equal(validateReplyParams({
    noteId: 'n',
    postUrl: 'https://www.xiaohongshu.com/explore/n',
    commentId: 'c',
    content: 'hello',
    visibleTab: false,
    screenshotPolicy: 'always',
  }).visibleTab, false)

  assert.equal(validateReplyParams({
    noteId: 'n',
    postUrl: 'https://www.xiaohongshu.com/explore/n',
    commentId: 'c',
    content: 'hello',
    screenshotPolicy: 'invalid',
  }).screenshotPolicy, 'failure')
})

test('buildXhsReplyBody builds Xiaohongshu reply body', () => {
  assert.deepEqual(buildXhsReplyBody({
    noteId: 'note-1',
    commentId: 'comment-1',
    content: '回复内容',
  }), {
    note_id: 'note-1',
    content: '回复内容',
    at_users: [],
    target_comment_id: 'comment-1',
  })
})

test('buildXhsDomReplyTarget builds stable selectors for real and fallback comment ids', () => {
  const realTarget = buildXhsDomReplyTarget({
    commentId: '6a1a9240000000002a02f671',
    content: '同款已整理在店铺里啦',
  })

  assert.deepEqual(realTarget, {
    commentId: '6a1a9240000000002a02f671',
    content: '同款已整理在店铺里啦',
    selectors: [
      '[data-comment-id="6a1a9240000000002a02f671"]',
      '[id="comment-6a1a9240000000002a02f671"]',
    ],
  })

  const fallbackTarget = buildXhsDomReplyTarget({
    commentId: 'dom:note-1:0',
    content: '回复内容',
  })
  assert.ok(fallbackTarget.selectors.includes('[data-comment-id="dom:note-1:0"]'))
  assert.ok(fallbackTarget.selectors.includes('[id="comment-dom:note-1:0"]'))
})

test('normalizeXhsDomReplyResponse handles dom automation responses', () => {
  assert.deepEqual(normalizeXhsDomReplyResponse({
    success: true,
    replyId: 'dom-reply-1',
  }), {
    success: true,
    replyId: 'dom-reply-1',
    message: 'DOM 自动化回复已发布',
    signatureRejected: false,
    rawData: {
      success: true,
      replyId: 'dom-reply-1',
    },
  })

  const failed = normalizeXhsDomReplyResponse({
    success: false,
    message: '未找到评论',
  })
  assert.equal(failed.success, false)
  assert.equal(failed.message, '未找到评论')
})

test('normalizeXhsReplyResponse handles success response', () => {
  const result = normalizeXhsReplyResponse({
    success: true,
    msg: 'ok',
    data: { comment: { id: 'reply-1' } },
  })

  assert.equal(result.success, true)
  assert.equal(result.replyId, 'reply-1')
  assert.equal(result.message, 'ok')
})

test('normalizeXhsReplyResponse flags likely signature failures', () => {
  const result = normalizeXhsReplyResponse({ code: 461, msg: 'x-s signature check failed' })
  assert.equal(result.success, false)
  assert.equal(result.signatureRejected, true)
})
