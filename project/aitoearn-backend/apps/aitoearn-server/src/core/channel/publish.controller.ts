/*
 * @Author: nevin
 * @Date: 2025-02-15 20:59:55
 * @LastEditTime: 2025-04-27 18:00:18
 * @LastEditors: nevin
 * @Description: 发布
 */
import { Body, Controller, Delete, Get, Logger, Param, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, Public, TokenInfo } from '@yikart/aitoearn-auth'
import { QueueService } from '@yikart/aitoearn-queue'
import { AssetsService } from '@yikart/assets'
import { MonitoredPostRepository } from '@yikart/channel-db'
import { ApiDoc, AppException, ParseObjectIdPipe, ResponseCode, TableDto } from '@yikart/common'
import { MetricEventHelperService, MetricEventName } from '@yikart/helpers'
import { PublishRecordLinkStatus, PublishStatus, PublishType } from '@yikart/mongodb'
import { plainToInstance } from 'class-transformer'
import { PublishRecordService } from '../publish-record/publish-record.service'
import { RelayClientService } from '../relay/relay-client.service'
import { ChannelAccountService } from './platforms/channel-account.service'
import { PlatformService } from './platforms/platforms.service'
import { PostHistoryItemVo, PublishRecordItemVo } from './publish-response.vo'
import {
  CreatePublishDto,
  CreatePublishRecordDto,
  PublishDayInfoListFiltersDto,
  PubRecordListFilterDto,
  UpdatePluginPublishResultDto,
  UpdatePublishRecordTimeDto,
  UpdatePublishRecordWorkLinkDto,
  UpdatePublishTaskDto,
  UpdateTokenFromPluginDto,
} from './publish.dto'
import { PublishService } from './publish.service'
import { PublishingService } from './publishing/publishing.service'

@ApiTags('渠道/发布')
@Controller('plat/publish')
export class PublishController {
  private readonly logger = new Logger(PublishController.name)

  constructor(
    private readonly publishService: PublishService,
    private readonly publishingService: PublishingService,
    private readonly publishRecordService: PublishRecordService,
    private readonly channelAccountService: ChannelAccountService,
    private readonly relayClientService: RelayClientService,
    private readonly assetsService: AssetsService,
    private readonly platformService: PlatformService,
    private readonly metricEventHelperService: MetricEventHelperService,
    private readonly queueService: QueueService,
    private readonly monitoredPostRepository: MonitoredPostRepository,
  ) { }

  @ApiDoc({
    summary: '公共发布创建',
    body: CreatePublishDto.schema,
  })
  @Public()
  @Post('pubCreate')
  async pubcCreate(@Body() data: CreatePublishDto) {
    data = plainToInstance(CreatePublishDto, data)
    return this.publishService.pubCreate(data)
  }

  @ApiDoc({
    summary: '创建发布任务',
    body: CreatePublishDto.schema,
  })
  @Post('create')
  async create(@GetToken() token: TokenInfo, @Body() data: CreatePublishDto) {
    data = plainToInstance(CreatePublishDto, data)
    const result = await this.publishService.create(token.id, data)
    await this.metricEventHelperService.record(token.id, MetricEventName.aiPublishPublish)
    return result
  }

  @ApiDoc({
    summary: '创建发布记录',
    body: CreatePublishRecordDto.schema,
  })
  @Post('createRecord')
  async createRecord(@GetToken() token: TokenInfo, @Body() data: CreatePublishRecordDto) {
    data = plainToInstance(CreatePublishRecordDto, data)

    const res = await this.publishRecordService.createPublishRecord({
      userId: token.id,
      ...data,
    })

    // 如果发布状态是已经完成
    if (data.status === PublishStatus.PUBLISHED) {
      await this.publishRecordService.completeById(res, data.dataId, { workLink: data.workLink || '' })
    }
    return res
  }

  @ApiDoc({
    summary: '更新发布记录作品链接',
    body: UpdatePublishRecordWorkLinkDto.schema,
  })
  @Post('updateRecordLink')
  async updateRecordLink(@GetToken() token: TokenInfo, @Body() data: UpdatePublishRecordWorkLinkDto) {
    data = plainToInstance(UpdatePublishRecordWorkLinkDto, data)

    const publishRecord = await this.publishRecordService.getPublishRecordInfo(data.id)
    if (!publishRecord || publishRecord.userId !== token.id) {
      throw new AppException(ResponseCode.PublishRecordNotFound)
    }
    if (!publishRecord.accountType) {
      throw new AppException(ResponseCode.PublishTaskInvalid, 'publish record accountType is missing')
    }

    const linkStatus = data.linkStatus || PublishRecordLinkStatus.READY

    if (linkStatus !== PublishRecordLinkStatus.READY) {
      const res = await this.publishRecordService.updateWorkLinkById(data.id, {
        dataId: data.dataId,
        platformWorkId: data.platformWorkId,
        linkStatus,
        linkError: data.linkError,
        linkMeta: data.linkMeta,
      })
      if (!res) {
        throw new AppException(ResponseCode.PublishRecordNotFound)
      }
      return res
    }

    if (!data.workLink) {
      throw new AppException(ResponseCode.InvalidWorkLink)
    }

    const workLinkInfo = await this.platformService.getWorkLinkInfo(
      publishRecord.accountType,
      data.workLink,
      data.platformWorkId || data.dataId,
      publishRecord.accountId,
    )
    if (!workLinkInfo?.dataId || !workLinkInfo.uniqueId) {
      throw new AppException(ResponseCode.InvalidWorkLink)
    }

    const res = await this.publishRecordService.updateWorkLinkById(data.id, {
      workLink: workLinkInfo.resolvedUrl || data.workLink,
      originalWorkLink: workLinkInfo.originalWorkLink ?? null,
      dataId: workLinkInfo.dataId,
      uniqueId: workLinkInfo.uniqueId,
      platformWorkId: data.platformWorkId,
      workStatus: workLinkInfo.workStatus ?? null,
      linkStatus,
      linkError: data.linkError,
      linkMeta: data.linkMeta,
      type: Object.values(PublishType).includes(workLinkInfo.type as PublishType)
        ? (workLinkInfo.type as PublishType)
        : undefined,
    })
    if (!res) {
      throw new AppException(ResponseCode.PublishRecordNotFound)
    }
    return res
  }

  @ApiDoc({
    summary: '更新插件发布结果',
    body: UpdatePluginPublishResultDto.schema,
  })
  @Post('pluginResult')
  async updatePluginPublishResult(@GetToken() token: TokenInfo, @Body() data: UpdatePluginPublishResultDto) {
    data = plainToInstance(UpdatePluginPublishResultDto, data)
    const publishRecord = data.id
      ? await this.publishRecordService.getPublishRecordInfo(data.id)
      : data.traceId
        ? await this.publishRecordService.getOneByTraceId(token.id, data.traceId)
        : null
    if (!publishRecord || publishRecord.userId !== token.id) {
      throw new AppException(ResponseCode.PublishRecordNotFound)
    }
    const publishRecordId = publishRecord.id || data.id || (publishRecord as any)._id?.toString()
    if (!publishRecordId) {
      throw new AppException(ResponseCode.PublishRecordNotFound)
    }

    if (!data.success) {
      return this.publishRecordService.failById(publishRecordId, data.errorMsg || 'plugin publish failed')
    }

    const finalDataId = data.noteId || data.dataId || publishRecord.dataId || data.traceId || publishRecordId

    if (data.pendingConfirmation || !data.workLink) {
      const pendingXhsWorkLinkMeta = data.workLink ? this.extractXhsWorkLinkMeta(data.workLink) : {}
      const pendingNoteId = this.resolveXhsNoteIdFromPayload(data, publishRecord)
      const pendingLinkMeta = {
        ...(publishRecord.linkMeta || {}),
        pendingConfirmation: true,
        ...(data.workLink && {
          unverifiedWorkLink: data.workLink,
          missingXsecToken: this.isXhsBareWorkLink(
            publishRecord.accountType,
            data.workLink,
            data.xsecToken,
            pendingXhsWorkLinkMeta.xsecToken,
          ),
        }),
      }
      await this.upsertXhsPublishedBackfillMonitor(publishRecord, publishRecordId, {
        noteId: pendingNoteId,
        workLink: data.workLink,
        authorUserId: data.authorUserId,
        xsecToken: data.xsecToken || pendingXhsWorkLinkMeta.xsecToken,
        xsecSource: data.xsecSource,
        fetchStatus: data.workLink ? 'reviewing' : 'pending_confirmation',
        linkStatus: PublishRecordLinkStatus.PENDING,
      })
      await this.publishRecordService.updateStatusById(publishRecordId, PublishStatus.PUBLISHING)
      return this.publishRecordService.updateWorkLinkById(publishRecordId, {
        dataId: pendingNoteId || pendingXhsWorkLinkMeta.postId || finalDataId,
        linkStatus: PublishRecordLinkStatus.PENDING,
        linkMeta: pendingLinkMeta,
      })
    }

    const xhsWorkLinkMeta = this.extractXhsWorkLinkMeta(data.workLink)
    if (this.isXhsBareWorkLink(publishRecord.accountType, data.workLink, data.xsecToken, xhsWorkLinkMeta.xsecToken)) {
      const noteId = this.resolveXhsNoteIdFromPayload(data, publishRecord)
      await this.upsertXhsPublishedBackfillMonitor(publishRecord, publishRecordId, {
        noteId,
        workLink: data.workLink,
        authorUserId: data.authorUserId,
        fetchStatus: 'pending_confirmation',
        linkStatus: PublishRecordLinkStatus.PENDING,
        linkError: 'XHS xsec_token is not available yet',
      })
      await this.publishRecordService.updateStatusById(publishRecordId, PublishStatus.PUBLISHING)
      return this.publishRecordService.updateWorkLinkById(publishRecordId, {
        dataId: noteId || xhsWorkLinkMeta.postId || finalDataId,
        linkStatus: PublishRecordLinkStatus.PENDING,
        linkError: 'XHS xsec_token is not available yet',
        linkMeta: {
          ...(publishRecord.linkMeta || {}),
          pendingConfirmation: true,
          missingXsecToken: true,
          unverifiedWorkLink: data.workLink,
        },
      })
    }

    // 有 workLink：先入监控(审核中链接暂不可访问也先记录，等审核通过后再抓取数据)
    await this.upsertXhsPublishedBackfillMonitor(publishRecord, publishRecordId, {
      noteId: this.resolveXhsNoteIdFromPayload(data, publishRecord),
      workLink: data.workLink,
      authorUserId: data.authorUserId,
      xsecToken: data.xsecToken || xhsWorkLinkMeta.xsecToken,
      xsecSource: data.xsecSource,
      fetchStatus: 'idle',
      linkStatus: PublishRecordLinkStatus.READY,
    })
    const acquisitionPlatform = this.toAcquisitionPlatform(publishRecord.accountType)
    if (acquisitionPlatform && publishRecord.accountId && publishRecord.userId) {
      await this.queueService.addAcquisitionPostBackfillJob({
        userId: publishRecord.userId,
        accountId: publishRecord.accountId,
        platform: acquisitionPlatform,
        postUrl: data.workLink,
        authorUserId: data.authorUserId,
        xsecToken: data.xsecToken,
        xsecSource: data.xsecSource,
      })
    }

    let workLinkInfo
    try {
      workLinkInfo = await this.platformService.getWorkLinkInfo(
        publishRecord.accountType,
        data.workLink,
        finalDataId,
        publishRecord.accountId,
      )
    }
    catch (error) {
      // 审核中等场景链接暂不可访问：作品已入监控，发布记录标记 PENDING 等待后续校验
      this.logger.warn(`Plugin publish result has unverified work link: ${data.workLink}`)
      await this.publishRecordService.updateStatusById(publishRecordId, PublishStatus.PUBLISHING)
      return this.publishRecordService.updateWorkLinkById(publishRecordId, {
        dataId: finalDataId,
        workLink: data.workLink,
        linkStatus: PublishRecordLinkStatus.PENDING,
        linkError: error instanceof Error ? error.message : 'invalid plugin work link',
        linkMeta: {
          ...(publishRecord.linkMeta || {}),
          pendingConfirmation: true,
        },
      })
    }

    return await this.publishRecordService.completeById(publishRecord, workLinkInfo.dataId, {
      workLink: workLinkInfo.resolvedUrl || data.workLink,
    })
  }

  @ApiDoc({
    summary: '从插件更新小红书作品 token',
    body: UpdateTokenFromPluginDto.schema,
  })
  @Post('updateTokenFromPlugin')
  async updateTokenFromPlugin(@GetToken() token: TokenInfo, @Body() data: UpdateTokenFromPluginDto) {
    data = plainToInstance(UpdateTokenFromPluginDto, data)

    const publishRecord = await this.publishRecordService.getPublishRecordInfo(data.publishRecordId)
    if (!publishRecord || publishRecord.userId !== token.id) {
      throw new AppException(ResponseCode.PublishRecordNotFound)
    }

    this.logger.log(`[updateTokenFromPlugin] Updating token for note ${data.noteId}`)

    // 更新 publish_record
    await this.publishRecordService.updateWorkLinkById(data.publishRecordId, {
      dataId: data.noteId,
      workLink: data.workLink,
      linkStatus: PublishRecordLinkStatus.READY,
      linkMeta: {
        ...(publishRecord.linkMeta || {}),
        pendingConfirmation: false,
        tokenAutoRefreshed: true,
        tokenRefreshedAt: new Date(),
      },
    })

    // 更新 monitored_post 并开始抓取数据
    await this.upsertXhsPublishedBackfillMonitor(publishRecord, data.publishRecordId, {
      noteId: data.noteId,
      workLink: data.workLink,
      authorUserId: data.authorUserId,
      xsecToken: data.xsecToken,
      xsecSource: data.xsecSource,
      fetchStatus: 'idle',
      linkStatus: PublishRecordLinkStatus.READY,
    })

    const acquisitionPlatform = this.toAcquisitionPlatform(publishRecord.accountType)
    if (acquisitionPlatform && publishRecord.accountId && publishRecord.userId) {
      await this.queueService.addAcquisitionPostBackfillJob({
        userId: publishRecord.userId,
        accountId: publishRecord.accountId,
        platform: acquisitionPlatform,
        postUrl: data.workLink,
        authorUserId: data.authorUserId,
        xsecToken: data.xsecToken,
        xsecSource: data.xsecSource,
      })
    }

    // 成功处理后移除刷新任务
    await this.queueService.removeXhsTokenRefreshJob(data.publishRecordId)

    this.logger.log(`[updateTokenFromPlugin] Token updated successfully for note ${data.noteId}`)
    return { success: true }
  }

  @ApiDoc({
    summary: '手动刷新小红书作品 token',
  })
  @Post('refreshXhsToken/:id')
  async refreshXhsToken(@GetToken() token: TokenInfo, @Param('id') id: string) {
    const publishRecord = await this.publishRecordService.getPublishRecordInfo(id)
    if (!publishRecord || publishRecord.userId !== token.id) {
      throw new AppException(ResponseCode.PublishRecordNotFound)
    }
    if (publishRecord.accountType !== 'xhs') {
      throw new AppException(ResponseCode.PublishTaskInvalid, 'Only XHS records can be refreshed')
    }

    const noteId = this.resolveXhsNoteId(publishRecord)
    const monitoredPost = noteId && publishRecord.accountId
      ? await this.monitoredPostRepository.getByIdentity(token.id, 'xhs', publishRecord.accountId, noteId)
      : null

    // 即使没有 noteId，也加入队列，让扩展去笔记管理页面扫描最新笔记
    // 扩展会按发布时间匹配并提取 token
    await this.queueService.addXhsTokenRefreshJob({
      publishRecordId: id,
      monitoredPostId: monitoredPost?.id || (monitoredPost as any)?._id?.toString(),
      userId: token.id,
      noteId: noteId || '',
      // 当 noteId 缺失时，让扩展扫描最新笔记
      scanLatest: !noteId,
      publishTime: publishRecord.createdAt?.getTime() || Date.now(),
    })
    return { success: true }
  }

  @ApiDoc({
    summary: '获取小红书 token 刷新任务列表',
  })
  @Get('xhsTokenRefreshJobs')
  async getXhsTokenRefreshJobs(@GetToken() token: TokenInfo) {
    return this.queueService.getXhsTokenRefreshJobs(token.id)
  }

  private async upsertXhsPublishedBackfillMonitor(
    publishRecord: any,
    publishRecordId: string,
    data: {
      noteId?: string | null
      workLink?: string
      authorUserId?: string
      xsecToken?: string
      xsecSource?: string
      fetchStatus: 'reviewing' | 'pending_confirmation' | 'idle' | 'ready' | 'failed'
      linkStatus: PublishRecordLinkStatus
      linkError?: string
    },
  ) {
    if (publishRecord.accountType !== 'xhs' || !publishRecord.userId || !publishRecord.accountId) return
    if (!this.isLikelyXhsNoteId(data.noteId || undefined)) return

    const xhsWorkLinkMeta = data.workLink ? this.extractXhsWorkLinkMeta(data.workLink) : {}
    const xsecToken = data.xsecToken || xhsWorkLinkMeta.xsecToken || ''
    const postUrl = data.workLink || this.buildXhsBareWorkLink(data.noteId!)
    const publishTraceId = this.resolvePublishTraceId(publishRecord)
    const cover = publishRecord.coverUrl || publishRecord.imgUrlList?.[0] || ''

    await this.monitoredPostRepository.upsertPublishedBackfillMonitor({
      userId: publishRecord.userId,
      platform: 'xhs',
      accountId: publishRecord.accountId,
      postId: data.noteId!,
      postUrl,
      title: publishRecord.title || '',
      cover,
      source: 'published_backfill',
      monitorStatus: data.linkStatus === PublishRecordLinkStatus.READY ? 'active' : 'published',
      fetchStatus: data.fetchStatus,
      capabilityReason: data.linkStatus === PublishRecordLinkStatus.READY
        ? ''
        : (data.linkError || 'XHS note is published but still under review or missing xsec_token'),
      authorUserId: data.authorUserId || '',
      xsecToken,
      xsecSource: data.xsecSource || (xsecToken ? 'pc_user' : ''),
      ...(xsecToken ? { xsecTokenUpdatedAt: new Date() } : {}),
      publishRecordId,
      publishTraceId,
      linkStatus: data.linkStatus,
      linkError: data.linkError || '',
    })
  }

  private toAcquisitionPlatform(accountType: unknown): 'xhs' | 'douyin' | 'kwai' | null {
    if (accountType === 'xhs') return 'xhs'
    if (accountType === 'douyin') return 'douyin'
    if (accountType === 'KWAI' || accountType === 'kwai') return 'kwai'
    return null
  }

  private buildXhsBareWorkLink(noteId: string): string {
    return `https://www.xiaohongshu.com/explore/${noteId}`
  }

  private extractXhsWorkLinkMeta(workLink: string): { postId?: string; xsecToken?: string } {
    try {
      const url = new URL(workLink)
      if (!/(^|\.)xiaohongshu\.com$/.test(url.hostname)) return {}

      const exploreMatch = url.pathname.match(/\/(?:explore|discovery\/item)\/([A-Za-z0-9]+)/)
      const profileMatch = url.pathname.match(/\/user\/profile\/[^/?#]+\/([A-Za-z0-9]+)/)
      return {
        postId: exploreMatch?.[1] || profileMatch?.[1],
        xsecToken: url.searchParams.get('xsec_token')?.trim() || undefined,
      }
    }
    catch (e) {
      return {}
    }
  }

  private isXhsBareWorkLink(accountType: unknown, workLink: string, payloadToken?: string, urlToken?: string): boolean {
    if (accountType !== 'xhs') return false
    const meta = this.extractXhsWorkLinkMeta(workLink)
    if (!meta.postId) return false
    return !payloadToken?.trim() && !urlToken?.trim() && !meta.xsecToken
  }

  private resolveXhsNoteId(record: { dataId?: string; workLink?: string; linkMeta?: Record<string, unknown> | null }): string | null {
    if (this.isLikelyXhsNoteId(record.dataId)) return record.dataId!

    const workLinkNoteId = record.workLink ? this.extractXhsWorkLinkMeta(record.workLink).postId : undefined
    if (this.isLikelyXhsNoteId(workLinkNoteId)) return workLinkNoteId!

    const unverifiedWorkLink = typeof record.linkMeta?.['unverifiedWorkLink'] === 'string'
      ? record.linkMeta['unverifiedWorkLink']
      : undefined
    const unverifiedNoteId = unverifiedWorkLink ? this.extractXhsWorkLinkMeta(unverifiedWorkLink).postId : undefined
    if (this.isLikelyXhsNoteId(unverifiedNoteId)) return unverifiedNoteId!

    return null
  }

  private resolveXhsNoteIdFromPayload(data: UpdatePluginPublishResultDto, record: { dataId?: string; workLink?: string; linkMeta?: Record<string, unknown> | null }): string | null {
    if (this.isLikelyXhsNoteId(data.noteId)) return data.noteId!
    if (this.isLikelyXhsNoteId(data.dataId)) return data.dataId!

    const payloadWorkLinkNoteId = data.workLink ? this.extractXhsWorkLinkMeta(data.workLink).postId : undefined
    if (this.isLikelyXhsNoteId(payloadWorkLinkNoteId)) return payloadWorkLinkNoteId!

    return this.resolveXhsNoteId(record)
  }

  private resolvePublishTraceId(record: { dataId?: string; linkMeta?: Record<string, unknown> | null }): string {
    const traceId = typeof record.linkMeta?.['traceId'] === 'string' ? record.linkMeta['traceId'] : ''
    if (traceId) return traceId
    return record.dataId?.startsWith('req-') ? record.dataId : ''
  }

  private isLikelyXhsNoteId(value?: string): boolean {
    return !!value && /^[A-Za-z0-9]{20,40}$/.test(value) && !value.startsWith('req-')
  }

  @ApiDoc({
    summary: '获取发布记录列表',
    body: PubRecordListFilterDto.schema,
    response: [PublishRecordItemVo],
  })
  @Post('getList')
  async getList(
    @GetToken() token: TokenInfo,
    @Body() data: PubRecordListFilterDto,
  ) {
    const local = await this.publishService.getList(data, token.id)
    const relay = await this.fetchRelayData<PublishRecordItemVo[]>(token.id, '/plat/publish/getList', data)
    return [...local, ...relay]
  }

  @ApiDoc({
    summary: '获取平台发布历史',
    body: PubRecordListFilterDto.schema,
    response: [PostHistoryItemVo],
  })
  @Post('posts')
  async getPosts(
    @GetToken() token: TokenInfo,
    @Body() data: PubRecordListFilterDto,
  ) {
    const local = await this.publishService.getPostHistory(data, token.id)
    const relay = await this.fetchRelayData<PostHistoryItemVo[]>(token.id, '/plat/publish/posts', data)
    return [...local, ...relay]
  }

  @ApiDoc({
    summary: '获取待发布任务列表',
    body: PubRecordListFilterDto.schema,
    response: [PostHistoryItemVo],
  })
  @Post('/statuses/queued/posts')
  async getQueuedPosts(
    @GetToken() token: TokenInfo,
    @Body() data: PubRecordListFilterDto,
  ) {
    const local = await this.publishService.getQueuedPublishingTasks(data, token.id)
    const relay = await this.fetchRelayData<PostHistoryItemVo[]>(token.id, '/plat/publish/statuses/queued/posts', data)
    return [...local, ...relay]
  }

  @ApiDoc({
    summary: '获取已发布作品列表',
    body: PubRecordListFilterDto.schema,
    response: [PostHistoryItemVo],
  })
  @Post('/statuses/published/posts')
  async getPublishedPosts(
    @GetToken() token: TokenInfo,
    @Body() data: PubRecordListFilterDto,
  ) {
    const local = await this.publishService.getPublishedPosts(data, token.id)
    const relay = await this.fetchRelayData<PostHistoryItemVo[]>(token.id, '/plat/publish/statuses/published/posts', data)
    return [...local, ...relay]
  }

  @ApiDoc({
    summary: '更新发布任务时间',
    body: UpdatePublishRecordTimeDto.schema,
  })
  @Post('updateTaskTime')
  async updatePublishRecordTime(
    @GetToken() token: TokenInfo,
    @Body() data: UpdatePublishRecordTimeDto,
  ) {
    return this.publishingService.updatePublishTaskTime(data.id, data.publishTime, token.id)
  }

  @ApiDoc({
    summary: '删除待发布任务',
  })
  @Delete('delete/:id')
  async delete(@GetToken() token: TokenInfo, @Param('id', ParseObjectIdPipe) id: string) {
    return this.publishingService.deletePublishTaskById(id, token.id)
  }

  @ApiDoc({
    summary: '立即发布任务',
  })
  @Post('nowPubTask/:id')
  async nowPubTask(@GetToken() token: TokenInfo, @Param('id', ParseObjectIdPipe) id: string) {
    return this.publishingService.publishTaskImmediately(id)
  }

  @ApiDoc({
    summary: '获取发布信息概览',
  })
  @Get('publishInfo/data')
  async publishInfoData(@GetToken() token: TokenInfo) {
    const result = await this.publishService.publishInfoData(token.id)
    await this.metricEventHelperService.record(token.id, MetricEventName.aiPublishPageView)
    return result
  }

  @ApiDoc({
    summary: '获取每日发布信息列表',
    query: PublishDayInfoListFiltersDto.schema,
  })
  @Get('publishDayInfo/list/:pageNo/:pageSize')
  async publishDataInfoList(
    @GetToken() token: TokenInfo,
    @Param() param: TableDto,
    @Query() query: PublishDayInfoListFiltersDto,
  ) {
    return this.publishService.publishDataInfoList(token.id, query, param)
  }

  @ApiDoc({
    summary: '根据流水ID获取发布任务列表',
  })
  @Get('task/:flowId')
  async getPublishTaskListOfFlowId(@GetToken() token: TokenInfo, @Param('flowId') flowId: string) {
    return this.publishService.getPublishTaskListOfFlowId(flowId, token.id)
  }

  @ApiDoc({
    summary: '获取发布记录详情',
  })
  @Get('records/:flowId')
  async getPublishRecordDetail(@GetToken() token: TokenInfo, @Param('flowId') flowId: string) {
    return this.publishService.getPublishRecordDetail(flowId, token.id)
  }

  @ApiDoc({
    summary: '根据ID获取发布记录详情',
  })
  @Public()
  @Get('record/:id')
  async getPublishRecordDetailById(@Param('id', ParseObjectIdPipe) id: string) {
    const record = await this.publishRecordService.getById(id)
    if (!record) {
      throw new AppException(ResponseCode.PublishRecordNotFound)
    }
    if (record.videoUrl) {
      record.videoUrl = this.assetsService.buildUrl(record.videoUrl)
    }
    if (record.coverUrl) {
      record.coverUrl = this.assetsService.buildUrl(record.coverUrl)
    }
    if (record.imgUrlList?.length) {
      record.imgUrlList = record.imgUrlList.map(url => this.assetsService.buildUrl(url))
    }
    return record
  }

  @ApiDoc({
    summary: '更新发布任务',
    body: UpdatePublishTaskDto.schema,
  })
  @Post('updateTask')
  async updatePublishTask(@GetToken() token: TokenInfo, @Body() data: UpdatePublishTaskDto) {
    return this.publishService.updatePublishTask(data, token.id)
  }

  private async fetchRelayData<T extends unknown[]>(userId: string, path: string, data: PubRecordListFilterDto): Promise<T> {
    if (!this.relayClientService.enabled) {
      return [] as unknown as T
    }
    try {
      const relayAccounts = await this.channelAccountService.listRelayAccountsByUserId(userId)
      if (relayAccounts.length === 0) {
        return [] as unknown as T
      }
      return await this.relayClientService.post<T>(path, {
        ...data,
        accountIds: relayAccounts.map(a => a.relayAccountRef),
      })
    }
    catch (error) {
      this.logger.error(error, 'Fetch relay publish records failed')
      return [] as unknown as T
    }
  }
}
