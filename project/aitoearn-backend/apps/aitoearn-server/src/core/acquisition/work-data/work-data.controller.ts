import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc, AppException, ResponseCode } from '@yikart/common'
import { CreateMonitoredPostDto, ListMonitoredPostQueryDto, SnapshotHistoryQueryDto, WorkCommentQueryDto } from './work-data.dto'
import { WorkDataService } from './work-data.service'
import { MonitoredPostListVo, MonitoredPostVo, WorkCommentListVo, WorkSnapshotVo } from './work-data.vo'

@ApiTags('Acquisition Work Data')
@Controller('/acquisition/work-data')
export class WorkDataController {
  constructor(private readonly workDataService: WorkDataService) {}

  @ApiDoc({ summary: 'Create monitored post manually', body: CreateMonitoredPostDto.schema, response: MonitoredPostVo })
  @Post('/monitored-posts')
  async createManual(@GetToken() token: TokenInfo, @Body() body: CreateMonitoredPostDto) {
    const res = await this.workDataService.createManual(token.id, body)
    return MonitoredPostVo.create(res)
  }

  @ApiDoc({ summary: 'List monitored posts', query: ListMonitoredPostQueryDto.schema, response: MonitoredPostListVo })
  @Get('/monitored-posts')
  async list(@GetToken() token: TokenInfo, @Query() query: ListMonitoredPostQueryDto) {
    const [list, total] = await this.workDataService.listMonitoredPosts(token.id, query)
    return new MonitoredPostListVo(list, total, query)
  }

  @ApiDoc({ summary: 'Backfill historical XHS published records into monitored posts' })
  @Post('/monitored-posts/backfill-published')
  async backfillPublished(@GetToken() token: TokenInfo) {
    return await this.workDataService.backfillHistoricalXhsPublishedMonitors(token.id)
  }

  @ApiDoc({ summary: 'Get monitored post detail', response: MonitoredPostVo })
  @Get('/monitored-posts/:id')
  async detail(@GetToken() token: TokenInfo, @Param('id') id: string) {
    const res = await this.workDataService.getDetail(token.id, id)
    return MonitoredPostVo.create(res)
  }

  @ApiDoc({ summary: 'Fetch monitored post now', response: MonitoredPostVo })
  @Post('/monitored-posts/:id/fetch')
  async fetchNow(@GetToken() token: TokenInfo, @Param('id') id: string) {
    const res = await this.workDataService.fetchNow(token.id, id)
    if (!res) throw new AppException(ResponseCode.MonitoredPostNotFound)
    return MonitoredPostVo.create(res as any)
  }

  @ApiDoc({ summary: 'Update monitored post status', response: MonitoredPostVo })
  @Patch('/monitored-posts/:id/status')
  async updateStatus(@GetToken() token: TokenInfo, @Param('id') id: string, @Body('status') status: string) {
    const res = await this.workDataService.updateStatus(token.id, id, status)
    if (!res) throw new AppException(ResponseCode.MonitoredPostNotFound)
    return MonitoredPostVo.create(res as any)
  }

  @ApiDoc({ summary: 'Delete monitored post' })
  @Delete('/monitored-posts/:id')
  async delete(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.workDataService.deleteMonitoredPost(token.id, id)
  }

  @ApiDoc({ summary: 'List post snapshot history', query: SnapshotHistoryQueryDto.schema, response: [WorkSnapshotVo] })
  @Get('/monitored-posts/:id/snapshots')
  async snapshots(@GetToken() token: TokenInfo, @Param('id') id: string, @Query() query: SnapshotHistoryQueryDto) {
    const list = await this.workDataService.listSnapshots(token.id, id, query.limit)
    return list.map(i => WorkSnapshotVo.create(i))
  }

  @ApiDoc({ summary: 'List monitored post comments', query: WorkCommentQueryDto.schema, response: WorkCommentListVo })
  @Get('/monitored-posts/:id/comments')
  async comments(@GetToken() token: TokenInfo, @Param('id') id: string, @Query() query: WorkCommentQueryDto) {
    const [list, total] = await this.workDataService.listComments(token.id, id, query)
    return new WorkCommentListVo(list, total, query)
  }
}
