import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc } from '@yikart/common'
import {
  AcquisitionCapabilityQueryDto,
  AcquisitionFetchWorkDto,
  AcquisitionSnapshotQueryDto,
} from './acquisition.dto'
import { AcquisitionService } from './acquisition.service'

@ApiTags('Acquisition')
@Controller('/acquisition')
export class AcquisitionController {
  constructor(private readonly acquisitionService: AcquisitionService) {}

  @ApiDoc({ summary: 'Fetch acquisition work and comments now', body: AcquisitionFetchWorkDto.schema })
  @Post('/works/fetch')
  async fetchWork(@GetToken() token: TokenInfo, @Body() body: AcquisitionFetchWorkDto) {
    const result = await this.acquisitionService.fetchNow(token.id, body)
    return {
      ...result,
      latestComments: result.comments.slice(0, 10).map(comment => ({
        commentId: comment.commentId,
        content: comment.content,
        dataSource: comment.dataSource,
      })),
    }
  }

  @ApiDoc({ summary: 'Enqueue acquisition comment fetch job', body: AcquisitionFetchWorkDto.schema })
  @Post('/works/fetch-jobs')
  async enqueueFetchWork(@GetToken() token: TokenInfo, @Body() body: AcquisitionFetchWorkDto) {
    return await this.acquisitionService.enqueueCommentFetch(token.id, body)
  }

  @ApiDoc({ summary: 'Get acquisition comment capability', query: AcquisitionCapabilityQueryDto.schema })
  @Get('/capability')
  async getCapability(@Query() query: AcquisitionCapabilityQueryDto) {
    return await this.acquisitionService.getCapability(query.accountId, query.platform as AcquisitionFetchWorkDto['platform'])
  }

  @ApiDoc({ summary: 'List persisted acquisition comments', query: AcquisitionSnapshotQueryDto.schema })
  @Get('/comments')
  async listComments(@Query() query: AcquisitionSnapshotQueryDto) {
    return await this.acquisitionService.listComments(query)
  }
}
