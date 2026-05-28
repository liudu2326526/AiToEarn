import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc, UserType } from '@yikart/common'
import {
  CreateHookTemplateDto,
  CreateScriptTemplateDto,
  GenerateAcquisitionContentDto,
  ListAcquisitionContentDto,
  ReviewAcquisitionContentDto,
  ScheduleAcquisitionContentDto,
  UpdatePlatformContentDto,
  UpsertAccountOpsConfigDto,
} from './acquisition-content.dto'
import {
  AccountOpsConfigVo,
  AcquisitionContentListVo,
  AcquisitionContentVo,
  HookTemplateVo,
  ScriptTemplateVo,
} from './acquisition-content.vo'
import { ContentGenerationService } from './content-generation.service'
import { ContentReviewService } from './content-review.service'
import { ContentScheduleService } from './content-schedule.service'
import { StrategyTemplateService } from './strategy-template.service'

import { AppException, ResponseCode } from '@yikart/common'

@ApiTags('Acquisition/Content')
@Controller('/acquisition')
export class AcquisitionContentController {
  constructor(
    private readonly contentGenerationService: ContentGenerationService,
    private readonly contentReviewService: ContentReviewService,
    private readonly contentScheduleService: ContentScheduleService,
    private readonly strategyTemplateService: StrategyTemplateService,
  ) {}

  @ApiDoc({ summary: 'Generate acquisition clothing content', body: GenerateAcquisitionContentDto.schema, response: AcquisitionContentVo })
  @Post('/content/generate')
  async generate(@GetToken() token: TokenInfo, @Body() body: GenerateAcquisitionContentDto) {
    const content = await this.contentGenerationService.generate(token.id, UserType.User, body)
    return AcquisitionContentVo.create(content)
  }

  @ApiDoc({ summary: 'List acquisition content', query: ListAcquisitionContentDto.schema, response: AcquisitionContentListVo })
  @Get('/content')
  async list(@GetToken() token: TokenInfo, @Query() query: ListAcquisitionContentDto) {
    const [list, total] = await this.contentReviewService.list(token.id, query)
    return new AcquisitionContentListVo(list, total, query)
  }

  @ApiDoc({ summary: 'Update one platform content variant', body: UpdatePlatformContentDto.schema, response: AcquisitionContentVo })
  @Post('/content/:id/platform-content')
  async updatePlatformContent(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: UpdatePlatformContentDto) {
    const content = await this.contentReviewService.updatePlatformContent(token.id, id, body)
    if (!content) throw new AppException(ResponseCode.AcquisitionContentNotFound)
    return AcquisitionContentVo.create(content)
  }

  @ApiDoc({ summary: 'Review acquisition content', body: ReviewAcquisitionContentDto.schema, response: AcquisitionContentVo })
  @Post('/content/:id/review')
  async review(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: ReviewAcquisitionContentDto) {
    const content = await this.contentReviewService.review(token.id, id, body)
    if (!content) throw new AppException(ResponseCode.AcquisitionContentNotFound)
    return AcquisitionContentVo.create(content)
  }

  @ApiDoc({ summary: 'Schedule approved acquisition content', body: ScheduleAcquisitionContentDto.schema, response: AcquisitionContentVo })
  @Post('/content/:id/schedule')
  async schedule(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: ScheduleAcquisitionContentDto) {
    const content = await this.contentScheduleService.schedule(token.id, id, body)
    if (!content) throw new AppException(ResponseCode.AcquisitionContentNotFound)
    return AcquisitionContentVo.create(content)
  }

  @ApiDoc({ summary: 'Upsert acquisition account operations config', body: UpsertAccountOpsConfigDto.schema, response: AccountOpsConfigVo })
  @Post('/strategy/accounts/:accountId/config')
  async upsertAccountConfig(@GetToken() token: TokenInfo, @Param('accountId') accountId: string, @Body() body: UpsertAccountOpsConfigDto) {
    const config = await this.strategyTemplateService.upsertAccountConfig(accountId, body)
    if (!config) throw new AppException(ResponseCode.StrategyTemplateNotFound)
    return AccountOpsConfigVo.create(config)
  }

  @ApiDoc({ summary: 'Create hook template', body: CreateHookTemplateDto.schema, response: HookTemplateVo })
  @Post('/strategy/hooks')
  async createHookTemplate(@GetToken() token: TokenInfo, @Body() body: CreateHookTemplateDto) {
    const template = await this.strategyTemplateService.createHookTemplate(token.id, body)
    return HookTemplateVo.create(template)
  }

  @ApiDoc({ summary: 'Create script template', body: CreateScriptTemplateDto.schema, response: ScriptTemplateVo })
  @Post('/strategy/scripts')
  async createScriptTemplate(@GetToken() token: TokenInfo, @Body() body: CreateScriptTemplateDto) {
    const template = await this.strategyTemplateService.createScriptTemplate(token.id, body)
    return ScriptTemplateVo.create(template)
  }
}
