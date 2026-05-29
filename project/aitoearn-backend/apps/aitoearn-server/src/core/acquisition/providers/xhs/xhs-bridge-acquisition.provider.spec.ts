import { describe, expect, it, vi } from 'vitest'
import {
  AcquisitionCapabilityStatus,
  AcquisitionDataSource,
  METRIC_KEY_COLLECT_COUNT,
  METRIC_KEY_COMMENT_COUNT,
  METRIC_KEY_LIKE_COUNT,
  METRIC_KEY_SHARE_COUNT,
} from '../../acquisition.constants'
import { XhsBridgeAcquisitionProvider } from './xhs-bridge-acquisition.provider'

describe('XhsBridgeAcquisitionProvider', () => {
  it('normalizes comments captured from XHS DOM comment items', async () => {
    const xhsBridgeService = {
      getStatus: vi.fn(() => ({ extensionConnected: true })),
      callExtension: vi.fn()
        .mockResolvedValueOnce({ tabId: 1 })
        .mockResolvedValueOnce({ loaded: true })
        .mockResolvedValueOnce({ stable: true })
        .mockResolvedValueOnce({ clicked: 1 })
        .mockResolvedValueOnce(JSON.stringify({
          location: 'https://www.xiaohongshu.com/explore/note-1?xsec_token=token-1',
          note: {
            title: '德比斯你收敛一点，你看看第二名多矜持！！',
            cover: 'https://example.com/cover.jpg',
            interactInfo: {
              likedCount: '1.2万',
              collectedCount: '930',
              commentCount: '591',
              sharedCount: '2,345',
            },
          },
          comments: [
            {
              id: 'dom:note-1:0',
              userName: '王子',
              userAvatar: '',
              content: '事实就是张雪现在的车队叫埃文兄弟车队',
              likeCount: 420,
              ipLocation: '江西',
              commentedAtText: '05-19',
              xsecToken: 'token-1',
              parentCommentId: '',
            },
            {
              id: 'dom:note-1:1',
              userName: '赵金贵',
              userAvatar: '',
              content: '49年入国军',
              likeCount: 321,
              ipLocation: '北京',
              commentedAtText: '05-19',
              xsecToken: 'token-1',
              parentCommentId: 'dom:note-1:0',
            },
          ],
          hasMore: true,
        })),
    }

    const provider = new XhsBridgeAcquisitionProvider(xhsBridgeService as any)
    const result = await provider.fetchWorkAndComments({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: '',
      postUrl: 'https://www.xiaohongshu.com/explore/note-1?xsec_token=token-1',
      fetchBatch: 'batch-1',
    } as any)

    expect(result.capabilityStatus).toBe(AcquisitionCapabilityStatus.Ready)
    expect(result.post?.title).toContain('德比斯')
    expect(result.post?.metrics.normalized[METRIC_KEY_LIKE_COUNT]).toBe(12000)
    expect(result.post?.metrics.normalized[METRIC_KEY_COLLECT_COUNT]).toBe(930)
    expect(result.post?.metrics.normalized[METRIC_KEY_COMMENT_COUNT]).toBe(591)
    expect(result.post?.metrics.normalized[METRIC_KEY_SHARE_COUNT]).toBe(2345)
    expect(result.comments).toHaveLength(2)
    expect(result.comments[0]).toEqual(expect.objectContaining({
      commentId: 'dom:note-1:0',
      userName: '王子',
      content: '事实就是张雪现在的车队叫埃文兄弟车队',
      likeCount: 420,
      ipLocation: '江西',
      xsecToken: 'token-1',
      dataSource: AcquisitionDataSource.XhsBridgeCapture,
    }))
    expect(result.comments[1]).toEqual(expect.objectContaining({
      parentCommentId: 'dom:note-1:0',
      userName: '赵金贵',
      content: '49年入国军',
    }))
  })

  it('uses the first XHS image list item as cover when note cover is absent', async () => {
    const xhsBridgeService = {
      getStatus: vi.fn(() => ({ extensionConnected: true })),
      callExtension: vi.fn()
        .mockResolvedValueOnce({ tabId: 1 })
        .mockResolvedValueOnce({ loaded: true })
        .mockResolvedValueOnce({ stable: true })
        .mockResolvedValueOnce({ clicked: 0 })
        .mockResolvedValueOnce(JSON.stringify({
          location: 'https://www.xiaohongshu.com/explore/note-2?xsec_token=token-2',
          note: {
            title: '小红书图文笔记',
            imageList: [
              { urlDefault: 'https://sns-img-qc.xhscdn.com/cover-default.webp' },
            ],
            interactInfo: {
              commentCount: '0',
            },
          },
          comments: [],
          hasMore: false,
        })),
    }

    const provider = new XhsBridgeAcquisitionProvider(xhsBridgeService as any)
    const result = await provider.fetchWorkAndComments({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: '',
      postUrl: 'https://www.xiaohongshu.com/explore/note-2?xsec_token=token-2',
      fetchBatch: 'batch-1',
    } as any)

    expect(result.post?.cover).toBe('https://sns-img-qc.xhscdn.com/cover-default.webp')
  })
})
