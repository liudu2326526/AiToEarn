import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc } from '@yikart/common'
import { MetricEventHelperService, MetricEventName } from '@yikart/helpers'
import {
  AcceptPromotionTaskDto,
  CreatePromotionTaskDto,
  PromotionTaskListDto,
  ReviewPromotionSubmissionDto,
  SubmitPromotionWorkDto,
  UpdatePromotionTaskDto,
} from './promotion-marketplace.dto'
import { PromotionMarketplaceService } from './promotion-marketplace.service'

@ApiTags('Promotion Marketplace')
@Controller('/promotion')
export class PromotionMarketplaceController {
  constructor(
    private readonly promotionMarketplaceService: PromotionMarketplaceService,
    private readonly metricEventHelperService: MetricEventHelperService,
  ) {}

  @ApiDoc({ summary: 'List promotion tasks', query: PromotionTaskListDto.schema })
  @Get('/creator/tasks')
  async listTasks(@GetToken() token: TokenInfo, @Query() query: PromotionTaskListDto) {
    await this.metricEventHelperService.record(token.id, MetricEventName.taskSquarePageView)
    return this.promotionMarketplaceService.listTasks(token.id, query)
  }

  @ApiDoc({ summary: 'Get promotion task detail' })
  @Get('/creator/tasks/:id')
  async getTaskDetail(@GetToken() token: TokenInfo, @Param('id') id: string) {
    await this.metricEventHelperService.record(token.id, MetricEventName.taskDetailView, {
      bizKey: id,
      properties: { taskId: id },
    })
    return this.promotionMarketplaceService.getTaskDetail(id)
  }

  @ApiDoc({ summary: 'Accept promotion task', body: AcceptPromotionTaskDto.schema })
  @Post('/creator/tasks/:id/accept')
  async acceptTask(
    @GetToken() token: TokenInfo,
    @Param('id') id: string,
    @Body() body: AcceptPromotionTaskDto,
  ) {
    await this.metricEventHelperService.record(token.id, MetricEventName.taskAccept, {
      bizKey: id,
      properties: { taskId: id },
    })
    return this.promotionMarketplaceService.acceptTask(token.id, id, body)
  }

  @ApiDoc({ summary: 'List creator promotion applications' })
  @Get('/creator/applications')
  async listCreatorApplications(
    @GetToken() token: TokenInfo,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.promotionMarketplaceService.listCreatorApplications(
      token.id,
      Number(page || 1),
      Number(pageSize || 20),
    )
  }

  @ApiDoc({ summary: 'Submit promotion work', body: SubmitPromotionWorkDto.schema })
  @Post('/creator/applications/:id/submit')
  async submitWork(
    @GetToken() token: TokenInfo,
    @Param('id') id: string,
    @Body() body: SubmitPromotionWorkDto,
  ) {
    await this.metricEventHelperService.record(token.id, MetricEventName.taskSubmit, {
      bizKey: id,
      properties: { applicationId: id },
    })
    return this.promotionMarketplaceService.submitWork(token.id, id, body)
  }

  @ApiDoc({ summary: 'Create advertiser promotion task', body: CreatePromotionTaskDto.schema })
  @Post('/advertiser/tasks')
  async createAdvertiserTask(
    @GetToken() token: TokenInfo,
    @Body() body: CreatePromotionTaskDto,
  ) {
    return this.promotionMarketplaceService.createAdvertiserTask(token.id, body)
  }

  @ApiDoc({ summary: 'List advertiser promotion tasks' })
  @Get('/advertiser/tasks')
  async listAdvertiserTasks(
    @GetToken() token: TokenInfo,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.promotionMarketplaceService.listAdvertiserTasks(
      token.id,
      Number(page || 1),
      Number(pageSize || 20),
    )
  }

  @ApiDoc({ summary: 'Update advertiser promotion task', body: UpdatePromotionTaskDto.schema })
  @Patch('/advertiser/tasks/:id')
  async updateAdvertiserTask(
    @GetToken() token: TokenInfo,
    @Param('id') id: string,
    @Body() body: UpdatePromotionTaskDto,
  ) {
    return this.promotionMarketplaceService.updateAdvertiserTask(token.id, id, body)
  }

  @ApiDoc({ summary: 'Review creator submission', body: ReviewPromotionSubmissionDto.schema })
  @Post('/advertiser/applications/:id/review')
  async reviewSubmission(
    @GetToken() token: TokenInfo,
    @Param('id') id: string,
    @Body() body: ReviewPromotionSubmissionDto,
  ) {
    if (body.approved) {
      await this.metricEventHelperService.record(token.id, MetricEventName.taskApproved, {
        bizKey: id,
        properties: { applicationId: id },
      })
    }
    return this.promotionMarketplaceService.reviewSubmission(token.id, id, body)
  }

  @ApiDoc({ summary: 'Get gold summary' })
  @Get('/gold/summary')
  async getGoldSummary(@GetToken() token: TokenInfo) {
    return this.promotionMarketplaceService.getGoldSummary(token.id)
  }

  @ApiDoc({ summary: 'List gold ledger' })
  @Get('/gold/ledger')
  async listLedger(
    @GetToken() token: TokenInfo,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.promotionMarketplaceService.listLedger(token.id, Number(page || 1), Number(pageSize || 20))
  }
}
