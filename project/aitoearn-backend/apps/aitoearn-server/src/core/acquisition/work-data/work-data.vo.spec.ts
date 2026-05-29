import { describe, expect, it } from 'vitest'
import { MonitoredPostVo, WorkCommentVo } from './work-data.vo'

describe('workDataVo schema', () => {
  it('allows nullable optional dates returned by mongoose defaults', () => {
    expect(() => MonitoredPostVo.create({
      id: 'monitored-1',
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1',
      title: '',
      cover: '',
      source: 'manual',
      monitorStatus: 'active',
      fetchStatus: 'idle',
      capabilityReason: '',
      latestPostSnapshotId: '',
      lastFetchedAt: null,
      nextFetchAt: null,
      latestMetrics: {},
      latestCommentCount: 0,
      lastFetchBatch: '',
      createdAt: new Date('2026-05-28T00:00:00.000Z'),
      updatedAt: new Date('2026-05-28T00:00:00.000Z'),
    })).not.toThrow()

    expect(() => WorkCommentVo.create({
      id: 'comment-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      commentId: 'comment-1',
      parentCommentId: '',
      userName: 'user',
      userAvatar: '',
      content: 'comment',
      likeCount: 0,
      ipLocation: '',
      commentedAt: null,
      fetchBatch: 'batch-1',
      dataSource: 'xhs_plugin_api',
    })).not.toThrow()
  })
})
