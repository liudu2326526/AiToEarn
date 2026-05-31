import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import {
  AddLeadNoteDto,
  AutoReplyLeadDto,
  AutoSelectLeadReplyStyleDto,
  BatchAutoReplyLeadsDto,
  BatchAssignLeadsDto,
  BatchUpdateLeadReplyStyleDto,
  LeadListQueryDto,
  LeadReplyTaskListQueryDto,
  LeadStatsQueryDto,
  MaterializeLeadsDto,
  PrivateMessageCapabilityQueryDto,
  ReplyResultDto,
  UpdateLeadAssigneeDto,
  UpdateLeadReplyStyleDto,
  UpdateLeadStageDto,
} from './acquisition-leads.dto'
import { LeadManagementService } from './lead-management.service'
import { LeadMaterializationService } from './lead-materialization.service'
import { ReplyAutomationService } from './reply-automation.service'
import { ReplyExecutionService } from './reply-execution.service'
import { ReplySuggestionService } from './reply-suggestion.service'

@ApiTags('Acquisition Leads')
@Controller('/acquisition/leads')
export class AcquisitionLeadsController {
  constructor(
    private readonly materializationService: LeadMaterializationService,
    private readonly leadManagementService: LeadManagementService,
    private readonly replySuggestionService: ReplySuggestionService,
    private readonly replyExecutionService: ReplyExecutionService,
    private readonly replyAutomationService: ReplyAutomationService,
  ) {}

  @Get('/private-message/capability')
  async privateMessageCapability(@GetToken() token: TokenInfo, @Query() query: PrivateMessageCapabilityQueryDto) {
    return await this.leadManagementService.privateMessageCapability(token.id, query)
  }

  @Get('/')
  async list(@GetToken() token: TokenInfo, @Query() query: LeadListQueryDto) {
    const [list, total] = await this.leadManagementService.list(token.id, query)
    return {
      list,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    }
  }

  @Get('/stats')
  async stats(@GetToken() token: TokenInfo, @Query() query: LeadStatsQueryDto) {
    return await this.leadManagementService.stats(token.id, query)
  }

  @Post('/materialize')
  async materialize(@GetToken() token: TokenInfo, @Body() body: MaterializeLeadsDto) {
    return await this.materializationService.materialize(token.id, body, token.id)
  }

  @Patch('/batch-assignee')
  async batchAssign(@GetToken() token: TokenInfo, @Body() body: BatchAssignLeadsDto) {
    return await this.leadManagementService.batchAssign(token.id, body.leadIds, body.assignee, token.id)
  }

  @Patch('/batch-reply-style')
  async batchReplyStyle(@GetToken() token: TokenInfo, @Body() body: BatchUpdateLeadReplyStyleDto) {
    return await this.leadManagementService.batchUpdateReplyStyle(token.id, body.leadIds, body.replyStyle, token.id)
  }

  @Patch('/auto-reply-style')
  async autoReplyStyle(@GetToken() token: TokenInfo, @Body() body: AutoSelectLeadReplyStyleDto) {
    return await this.leadManagementService.autoSelectReplyStyles(token.id, body, token.id)
  }

  @Post('/auto-reply/batch')
  async batchAutoReply(@GetToken() token: TokenInfo, @Body() body: BatchAutoReplyLeadsDto) {
    return await this.replyAutomationService.createBatchTasks(token.id, body, token.id)
  }

  @Get('/reply-tasks')
  async replyTasks(@GetToken() token: TokenInfo, @Query() query: LeadReplyTaskListQueryDto) {
    return await this.replyAutomationService.listTasks(token.id, query)
  }

  @Post('/reply-tasks/:taskId/cancel')
  async cancelReplyTask(@GetToken() token: TokenInfo, @Param('taskId') taskId: string) {
    return await this.replyAutomationService.cancelTask(token.id, taskId, token.id)
  }

  @Post('/reply-tasks/:taskId/retry')
  async retryReplyTask(@GetToken() token: TokenInfo, @Param('taskId') taskId: string) {
    return await this.replyAutomationService.retryTask(token.id, taskId, token.id)
  }

  @Get('/:id')
  async detail(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.leadManagementService.detail(token.id, id)
  }

  @Get('/:id/timeline')
  async timeline(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.leadManagementService.timeline(token.id, id)
  }

  @Post('/:id/claim')
  async claim(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.leadManagementService.assign(token.id, id, token.id, token.id)
  }

  @Patch('/:id/assignee')
  async assign(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: UpdateLeadAssigneeDto) {
    return await this.leadManagementService.assign(token.id, id, body.assignee, token.id)
  }

  @Patch('/:id/reply-style')
  async replyStyle(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: UpdateLeadReplyStyleDto) {
    return await this.leadManagementService.updateReplyStyle(token.id, id, body.replyStyle, token.id)
  }

  @Patch('/:id/stage')
  async stage(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: UpdateLeadStageDto) {
    return await this.leadManagementService.changeStage(token.id, id, body.stage, token.id)
  }

  @Post('/:id/notes')
  async note(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: AddLeadNoteDto) {
    return await this.leadManagementService.addNote(token.id, id, body.note, token.id)
  }

  @Post('/:id/reply-suggestion')
  async suggestion(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.replySuggestionService.generate(token.id, id, token.id)
  }

  @Post('/:id/auto-reply')
  async autoReply(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: AutoReplyLeadDto) {
    return await this.replyAutomationService.createSingleTask(token.id, id, body, token.id)
  }

  @Get('/:id/reply-tasks')
  async leadReplyTasks(@GetToken() token: TokenInfo, @Param('id') id: string, @Query() query: LeadReplyTaskListQueryDto) {
    return await this.replyAutomationService.listTasks(token.id, { ...query, leadId: id })
  }

  @Post('/:id/reply-result')
  async replyResult(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: ReplyResultDto) {
    return await this.replyExecutionService.recordResult(token.id, id, body, token.id)
  }
}
