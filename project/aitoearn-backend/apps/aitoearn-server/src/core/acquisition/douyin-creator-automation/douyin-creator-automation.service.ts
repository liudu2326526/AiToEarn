import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import {
  CommentSnapshotRepository,
  LeadActivityLogRepository,
  LeadRepository,
} from '@yikart/channel-db'
import { AcquisitionDataSource, AcquisitionPlatform } from '../acquisition.constants'
import {
  DouyinCreatorArticlePublishDryRunDto,
  DouyinCreatorImageTextPublishDryRunDto,
  DouyinCreatorImportCommentsDto,
  DouyinCreatorImportDmsDto,
  DouyinCreatorReplyDto,
} from './douyin-creator-automation.dto'
import { DouyinCreatorCliService } from './douyin-creator-cli.service'

@Injectable()
export class DouyinCreatorAutomationService {
  constructor(
    private readonly cliService: DouyinCreatorCliService,
    private readonly commentSnapshotRepository: CommentSnapshotRepository,
    private readonly leadRepository: LeadRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
  ) {}

  async getStatus() {
    return await this.cliService.getStatus()
  }

  async importComments(_userId: string, dto: DouyinCreatorImportCommentsDto, _operatorId: string) {
    const result = await this.cliService.exportComments(dto)
    const comments = Array.isArray(result['comments']) ? result['comments'] as Array<Record<string, unknown>> : []
    const selectedWork = this.asObject(result['selectedWork'])
    const postTitle = String(selectedWork['title'] || dto.workTitle || '')
    const postPublishText = String(selectedWork['publishText'] || '')
    const postId = `creator-work:${this.hash([dto.accountId, postTitle, postPublishText].join('\n'))}`
    const fetchBatch = `douyin-creator-${Date.now()}`

    const snapshots = comments
      .map((comment, index) => {
        const username = String(comment['username'] || '').trim()
        const content = String(comment['commentText'] || comment['comment'] || comment['text'] || '').trim()
        if (!username || !content)
          return null
        const publishText = String(comment['publishText'] || '')
        return {
          platform: AcquisitionPlatform.Douyin,
          accountId: dto.accountId,
          postId,
          commentId: `creator-comment:${this.hash([postId, username, content, publishText, index].join('\n'))}`,
          parentCommentId: '',
          userName: username,
          userAvatar: '',
          content,
          likeCount: 0,
          ipLocation: '',
          xsecToken: '',
          fetchBatch,
          dataSource: AcquisitionDataSource.DouyinCreatorCenter,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    await this.commentSnapshotRepository.bulkUpsertByCommentId(snapshots)

    let materialized = 0
    for (const snapshot of snapshots) {
      const upsert = await this.leadRepository.upsertFromComment({
        userId: _userId,
        platform: snapshot.platform,
        accountId: snapshot.accountId,
        postId: snapshot.postId,
        postTitle,
        postUrl: String(result['pageUrl'] || ''),
        postCover: '',
        commentId: snapshot.commentId,
        parentCommentId: '',
        userName: snapshot.userName,
        userAvatar: '',
        sourceContent: snapshot.content,
      })
      if (upsert.lead?.id) {
        materialized += 1
        if (upsert.created) {
          await this.leadActivityLogRepository.append({
            userId: _userId,
            leadId: upsert.lead.id,
            action: 'materialized',
            operatorId: _operatorId,
            note: `Materialized from Douyin Creator comment ${snapshot.commentId}`,
          })
        }
      }
    }

    return {
      imported: snapshots.length,
      materialized,
      resultPath: String(result['outputPath'] || ''),
      warnings: [] as string[],
    }
  }

  async importDms(_userId: string, dto: DouyinCreatorImportDmsDto, _operatorId: string) {
    const result = await this.cliService.exportDms()
    const conversations = Array.isArray(result['conversations']) ? result['conversations'] as Array<Record<string, unknown>> : []
    const warnings: string[] = []
    let imported = 0
    let materialized = 0

    for (const conversation of conversations.slice(0, dto.limit)) {
      const username = String(conversation['username'] || '').trim()
      const lastMessage = String(conversation['lastMessage'] || conversation['message'] || conversation['text'] || '').trim()
      const unsupported = Boolean(conversation['unsupportedMessage']) || lastMessage.includes('你收到一条新类型消息，请打开抖音app查看')
      if (!username || !lastMessage || unsupported) {
        if (username)
          warnings.push(`unsupported_dm_message:${username}`)
        continue
      }

      const upsert = await this.leadRepository.createOrUpdateByPrivateMessage({
        userId: _userId,
        platform: AcquisitionPlatform.Douyin,
        accountId: dto.accountId,
        userName: username,
        sourceContent: lastMessage,
        externalConversationId: `dm:${this.hash([dto.accountId, username].join('\n'))}`,
        lastMessageTime: String(conversation['lastMessageTime'] || ''),
      })
      imported += 1
      if (upsert.lead?.id) {
        materialized += 1
        if (upsert.created) {
          await this.leadActivityLogRepository.append({
            userId: _userId,
            leadId: upsert.lead.id,
            action: 'materialized',
            operatorId: _operatorId,
            note: `Materialized from Douyin Creator DM ${username}`,
          })
        }
      }
    }

    return {
      imported,
      materialized,
      resultPath: String(result['outputPath'] || ''),
      warnings,
    }
  }

  async createCommentReplyTasks(_userId: string, dto: DouyinCreatorReplyDto, _operatorId: string) {
    return {
      dryRun: dto.dryRun,
      queued: 0,
      success: 0,
      humanRequired: dto.leadIds.length,
      failed: 0,
      taskIds: [] as string[],
    }
  }

  async createDmReplyTasks(_userId: string, dto: DouyinCreatorReplyDto, _operatorId: string) {
    return {
      dryRun: dto.dryRun,
      queued: 0,
      success: 0,
      humanRequired: dto.leadIds.length,
      failed: 0,
      taskIds: [] as string[],
    }
  }

  async prepareArticlePublishDryRun(dto: DouyinCreatorArticlePublishDryRunDto) {
    return await this.cliService.prepareArticlePublishDryRun({
      title: dto.title,
      subtitle: dto.subtitle || '',
      content: dto.content,
      imagePath: dto.imagePath,
      music: dto.music || '',
      tags: dto.tags || [],
    })
  }

  async prepareImageTextPublishDryRun(dto: DouyinCreatorImageTextPublishDryRunDto) {
    return await this.cliService.prepareImageTextPublishDryRun({
      title: dto.title || '',
      description: dto.description || '',
      imagePaths: dto.imagePaths,
      music: dto.music || '',
    })
  }

  async executeCommentReply(input: {
    postTitle: string
    postPublishText?: string
    commentUserName: string
    commentText: string
    replyContent: string
    dryRun: boolean
  }) {
    const result = await this.cliService.replyComments({
      dryRun: input.dryRun,
      limit: 1,
      plan: {
        selectedWork: {
          title: input.postTitle,
          publishText: input.postPublishText || '',
        },
        comments: [
          {
            username: input.commentUserName,
            commentText: input.commentText,
            replyMessage: input.replyContent,
          },
        ],
      },
    })

    return this.toReplyExecutionResult(result, {
      successStatuses: ['replied'],
      dryRunPrefix: 'douyin-comment-dry-run',
      sentPrefix: 'douyin-comment-replied',
    })
  }

  async executeDmReply(input: {
    conversationUserName: string
    lastMessage: string
    lastMessageTime?: string
    replyContent: string
    dryRun: boolean
  }) {
    const result = await this.cliService.replyDms({
      dryRun: input.dryRun,
      limit: 1,
      plan: {
        conversations: [
          {
            username: input.conversationUserName,
            lastMessage: input.lastMessage,
            lastMessageTime: input.lastMessageTime || '',
            unsupportedMessage: false,
            replyMessage: input.replyContent,
          },
        ],
      },
    })

    return this.toReplyExecutionResult(result, {
      successStatuses: ['sent'],
      dryRunPrefix: 'douyin-dm-dry-run',
      sentPrefix: 'douyin-dm-sent',
    })
  }

  private hash(value: string) {
    return createHash('sha1').update(value).digest('hex').slice(0, 16)
  }

  private asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  }

  private toReplyExecutionResult(result: Record<string, unknown>, options: {
    successStatuses: string[]
    dryRunPrefix: string
    sentPrefix: string
  }) {
    const results = Array.isArray(result['results']) ? result['results'] as Array<Record<string, unknown>> : []
    const first = results[0] || {}
    const status = String(first['status'] || '')
    const success = options.successStatuses.includes(status)
    const dryRunCompleted = status === 'dry_run_typed'
    const replyPlanId = String(first['replyPlanId'] || '1')
    const prefix = status === 'dry_run_typed' ? options.dryRunPrefix : options.sentPrefix
    const failureReason = [
      status || 'douyin_creator_reply_failed',
      String(first['errorStage'] || ''),
      String(first['error'] || ''),
    ].filter(Boolean).join(': ')

    return {
      success,
      platformReplyId: success || dryRunCompleted ? `${prefix}:${replyPlanId}` : '',
      needHumanAssist: !success,
      failureReason: success ? '' : dryRunCompleted ? 'dry_run_completed' : failureReason,
    }
  }
}
