import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc } from '@yikart/common'
import { ReplyAutomationService } from '../leads/reply-automation.service'
import {
  DouyinCreatorArticlePublishDryRunDto,
  DouyinCreatorImageTextPublishDryRunDto,
  DouyinCreatorImportCommentsDto,
  DouyinCreatorImportDmsDto,
  DouyinCreatorReplyDto,
} from './douyin-creator-automation.dto'
import { DouyinCreatorAutomationService } from './douyin-creator-automation.service'

@ApiTags('Acquisition/Douyin Creator')
@Controller('/acquisition/douyin-creator')
export class DouyinCreatorAutomationController {
  constructor(
    private readonly automationService: DouyinCreatorAutomationService,
    private readonly replyAutomationService: ReplyAutomationService,
  ) {}

  @ApiDoc({ summary: 'Get Douyin Creator Center local automation status' })
  @Get('/status')
  async status() {
    return await this.automationService.getStatus()
  }

  @ApiDoc({ summary: 'Import comments from Douyin Creator Center', body: DouyinCreatorImportCommentsDto.schema })
  @Post('/comments/import')
  async importComments(@GetToken() token: TokenInfo, @Body() body: DouyinCreatorImportCommentsDto) {
    return await this.automationService.importComments(token.id, body, token.id)
  }

  @ApiDoc({ summary: 'Import DM conversations from Douyin Creator Center', body: DouyinCreatorImportDmsDto.schema })
  @Post('/dms/import')
  async importDms(@GetToken() token: TokenInfo, @Body() body: DouyinCreatorImportDmsDto) {
    return await this.automationService.importDms(token.id, body, token.id)
  }

  @ApiDoc({ summary: 'Prepare a local Douyin Creator Center article publish dry-run command', body: DouyinCreatorArticlePublishDryRunDto.schema })
  @Post('/publish/article/dry-run')
  async prepareArticlePublishDryRun(@Body() body: DouyinCreatorArticlePublishDryRunDto) {
    return await this.automationService.prepareArticlePublishDryRun(body)
  }

  @ApiDoc({ summary: 'Prepare a local Douyin Creator Center image-text publish dry-run command', body: DouyinCreatorImageTextPublishDryRunDto.schema })
  @Post('/publish/imagetext/dry-run')
  async prepareImageTextPublishDryRun(@Body() body: DouyinCreatorImageTextPublishDryRunDto) {
    return await this.automationService.prepareImageTextPublishDryRun(body)
  }

  @ApiDoc({ summary: 'Create Douyin Creator Center comment reply tasks', body: DouyinCreatorReplyDto.schema })
  @Post('/comments/reply')
  async replyComments(@GetToken() token: TokenInfo, @Body() body: DouyinCreatorReplyDto) {
    return await this.replyAutomationService.createTasksForLeadIds(token.id, body.leadIds, {
      dryRun: body.dryRun,
      targetType: 'public_comment',
      limit: body.limit,
    }, token.id)
  }

  @ApiDoc({ summary: 'Create Douyin Creator Center DM reply tasks', body: DouyinCreatorReplyDto.schema })
  @Post('/dms/reply')
  async replyDms(@GetToken() token: TokenInfo, @Body() body: DouyinCreatorReplyDto) {
    return await this.replyAutomationService.createTasksForLeadIds(token.id, body.leadIds, {
      dryRun: body.dryRun,
      targetType: 'private_message',
      limit: body.limit,
    }, token.id)
  }
}
