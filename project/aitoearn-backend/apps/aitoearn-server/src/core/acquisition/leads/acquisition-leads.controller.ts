import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import {
  AddLeadNoteDto,
  BatchAssignLeadsDto,
  LeadListQueryDto,
  LeadStatsQueryDto,
  MaterializeLeadsDto,
  PrivateMessageCapabilityQueryDto,
  ReplyResultDto,
  UpdateLeadAssigneeDto,
  UpdateLeadStageDto,
} from './acquisition-leads.dto'
import { LeadManagementService } from './lead-management.service'
import { LeadMaterializationService } from './lead-materialization.service'
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

  @Post('/:id/reply-result')
  async replyResult(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: ReplyResultDto) {
    return await this.replyExecutionService.recordResult(token.id, id, body, token.id)
  }
}
