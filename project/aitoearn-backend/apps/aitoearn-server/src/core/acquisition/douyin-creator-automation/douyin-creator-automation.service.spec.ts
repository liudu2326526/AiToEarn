import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DouyinCreatorAutomationService } from './douyin-creator-automation.service'

describe('douyinCreatorAutomationService', () => {
  const cliService = {
    getStatus: vi.fn(),
    exportComments: vi.fn(),
    exportDms: vi.fn(),
    replyComments: vi.fn(),
    replyDms: vi.fn(),
    prepareArticlePublishDryRun: vi.fn(),
    prepareImageTextPublishDryRun: vi.fn(),
  }
  const commentSnapshotRepository = {
    bulkUpsertByCommentId: vi.fn(),
  }
  const leadRepository = {
    upsertFromComment: vi.fn(),
    createOrUpdateByPrivateMessage: vi.fn(),
  }
  const leadActivityLogRepository = {
    append: vi.fn(),
  }

  let service: DouyinCreatorAutomationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DouyinCreatorAutomationService(
      cliService as any,
      commentSnapshotRepository as any,
      leadRepository as any,
      leadActivityLogRepository as any,
    )
  })

  it('imports creator-center comments as comment snapshots and public-comment leads', async () => {
    cliService.exportComments.mockResolvedValue({
      pageUrl: 'https://creator.douyin.com/creator-micro/interactive/comment',
      selectedWork: {
        title: '作品标题',
        publishText: '发布于2026年04月30日 20:00',
      },
      comments: [
        {
          username: '用户A',
          commentText: '想了解',
          publishText: '刚刚',
          replyMessage: '',
        },
      ],
      outputPath: '/tmp/comments.json',
    })
    commentSnapshotRepository.bulkUpsertByCommentId.mockResolvedValue({ upsertedCount: 1 })
    leadRepository.upsertFromComment.mockResolvedValue({ lead: { id: 'lead-1' }, created: true })

    const result = await service.importComments('user-1', {
      accountId: 'account-1',
      workTitle: '作品标题',
      exportAll: false,
      limit: 500,
    }, 'operator-1')

    expect(commentSnapshotRepository.bulkUpsertByCommentId).toHaveBeenCalledWith([
      expect.objectContaining({
        platform: 'douyin',
        accountId: 'account-1',
        dataSource: 'douyin_creator_center',
        content: '想了解',
        userName: '用户A',
        fetchBatch: expect.stringMatching(/^douyin-creator-/),
        commentId: expect.stringMatching(/^creator-comment:/),
      }),
    ])
    expect(leadRepository.upsertFromComment).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      platform: 'douyin',
      accountId: 'account-1',
      postTitle: '作品标题',
      userName: '用户A',
      sourceContent: '想了解',
    }))
    expect(leadActivityLogRepository.append).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      leadId: 'lead-1',
      action: 'materialized',
    }))
    expect(result).toEqual(expect.objectContaining({
      imported: 1,
      materialized: 1,
      resultPath: '/tmp/comments.json',
      warnings: [],
    }))
  })

  it('imports supported DM conversations and skips unsupported message types', async () => {
    cliService.exportDms.mockResolvedValue({
      mode: 'dm_export',
      pageUrl: 'https://creator.douyin.com/creator-micro/data/following/chat',
      conversations: [
        {
          username: '睡不醒镁人',
          lastMessage: '滴滴滴',
          lastMessageTime: '刚刚',
          unsupportedMessage: false,
        },
        {
          username: 'AI剧阿涛',
          lastMessage: '你收到一条新类型消息，请打开抖音app查看',
          lastMessageTime: '05-27',
          unsupportedMessage: true,
        },
      ],
      outputPath: '/tmp/dms.json',
    })
    leadRepository.createOrUpdateByPrivateMessage.mockResolvedValue({ lead: { id: 'lead-dm-1' }, created: true })

    const result = await service.importDms('user-1', {
      accountId: 'account-1',
      limit: 50,
    }, 'operator-1')

    expect(leadRepository.createOrUpdateByPrivateMessage).toHaveBeenCalledTimes(1)
    expect(leadRepository.createOrUpdateByPrivateMessage).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      platform: 'douyin',
      accountId: 'account-1',
      userName: '睡不醒镁人',
      sourceContent: '滴滴滴',
      externalConversationId: expect.stringMatching(/^dm:/),
      lastMessageTime: '刚刚',
    }))
    expect(result).toEqual(expect.objectContaining({
      imported: 1,
      materialized: 1,
      resultPath: '/tmp/dms.json',
      warnings: ['unsupported_dm_message:AI剧阿涛'],
    }))
  })

  it('executes a creator-center comment reply with the CLI plan contract', async () => {
    cliService.replyComments.mockResolvedValue({
      replyDryRun: true,
      repliedCount: 0,
      dryRunCount: 1,
      results: [
        {
          replyPlanId: 1,
          username: '用户A',
          commentText: '想了解',
          status: 'dry_run_typed',
        },
      ],
    })

    const result = await service.executeCommentReply({
      postTitle: '作品标题',
      postPublishText: '发布于2026年04月30日 20:00',
      commentUserName: '用户A',
      commentText: '想了解',
      replyContent: '可以看主页同款入口哦',
      dryRun: true,
    })

    expect(cliService.replyComments).toHaveBeenCalledWith({
      dryRun: true,
      limit: 1,
      plan: {
        selectedWork: {
          title: '作品标题',
          publishText: '发布于2026年04月30日 20:00',
        },
        comments: [
          {
            username: '用户A',
            commentText: '想了解',
            replyMessage: '可以看主页同款入口哦',
          },
        ],
      },
    })
    expect(result).toEqual(expect.objectContaining({
      success: false,
      needHumanAssist: true,
      failureReason: 'dry_run_completed',
      platformReplyId: 'douyin-comment-dry-run:1',
    }))
  })

  it('executes a creator-center DM reply with the CLI plan contract', async () => {
    cliService.replyDms.mockResolvedValue({
      replyDryRun: false,
      sentCount: 1,
      dryRunCount: 0,
      results: [
        {
          replyPlanId: 1,
          username: '睡不醒镁人',
          lastMessage: '滴滴滴',
          status: 'sent',
        },
      ],
    })

    const result = await service.executeDmReply({
      conversationUserName: '睡不醒镁人',
      lastMessage: '滴滴滴',
      lastMessageTime: '刚刚',
      replyContent: '你好，可以继续说下你的需求',
      dryRun: false,
    })

    expect(cliService.replyDms).toHaveBeenCalledWith({
      dryRun: false,
      limit: 1,
      plan: {
        conversations: [
          {
            username: '睡不醒镁人',
            lastMessage: '滴滴滴',
            lastMessageTime: '刚刚',
            unsupportedMessage: false,
            replyMessage: '你好，可以继续说下你的需求',
          },
        ],
      },
    })
    expect(result).toEqual(expect.objectContaining({
      success: true,
      platformReplyId: 'douyin-dm-sent:1',
    }))
  })

  it('prepares a local article publish dry-run command', async () => {
    cliService.prepareArticlePublishDryRun.mockResolvedValue({
      mode: 'article_publish_prepare',
      dryRun: true,
      inputPath: '/tmp/article.json',
      command: ['npm', 'run', 'article:publish', '--', '--dry-run', '/tmp/article.json'],
    })

    const result = await service.prepareArticlePublishDryRun({
      title: '文章标题',
      subtitle: '摘要',
      content: '正文',
      imagePath: '/tmp/cover.png',
      music: '星际穿越',
      tags: ['标签1'],
    })

    expect(cliService.prepareArticlePublishDryRun).toHaveBeenCalledWith({
      title: '文章标题',
      subtitle: '摘要',
      content: '正文',
      imagePath: '/tmp/cover.png',
      music: '星际穿越',
      tags: ['标签1'],
    })
    expect(result).toEqual(expect.objectContaining({
      mode: 'article_publish_prepare',
      dryRun: true,
      inputPath: '/tmp/article.json',
    }))
  })

  it('prepares a local image-text publish dry-run command', async () => {
    cliService.prepareImageTextPublishDryRun.mockResolvedValue({
      mode: 'imagetext_publish_prepare',
      dryRun: true,
      inputPath: '/tmp/imagetext.json',
      command: ['npm', 'run', 'imagetext:publish', '--', '--dry-run', '/tmp/imagetext.json'],
    })

    const result = await service.prepareImageTextPublishDryRun({
      title: '图文标题',
      description: '图文描述',
      imagePaths: ['/tmp/1.png'],
      music: '',
    })

    expect(cliService.prepareImageTextPublishDryRun).toHaveBeenCalledWith({
      title: '图文标题',
      description: '图文描述',
      imagePaths: ['/tmp/1.png'],
      music: '',
    })
    expect(result).toEqual(expect.objectContaining({
      mode: 'imagetext_publish_prepare',
      dryRun: true,
      inputPath: '/tmp/imagetext.json',
    }))
  })
})
