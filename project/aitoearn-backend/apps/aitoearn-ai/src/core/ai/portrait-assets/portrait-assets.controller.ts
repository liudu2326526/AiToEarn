import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc, UserType } from '@yikart/common'
import { CreatePortraitAssetDto, ListPortraitAssetsDto } from './portrait-assets.dto'
import { PortraitAssetsService } from './portrait-assets.service'
import { PortraitAssetListVo, PortraitAssetVo } from './portrait-assets.vo'

@ApiTags('Me/Ai/PortraitAssets')
@Controller('ai/portrait-assets')
export class PortraitAssetsController {
  constructor(private readonly portraitAssetsService: PortraitAssetsService) {}

  @ApiDoc({
    summary: 'List private portrait assets',
    query: ListPortraitAssetsDto.schema,
    response: PortraitAssetListVo,
  })
  @Get('/')
  async list(
    @GetToken() token: TokenInfo,
    @Query() query: ListPortraitAssetsDto,
  ) {
    return this.portraitAssetsService.list(token.id, UserType.User, query)
  }

  @ApiDoc({
    summary: 'Register private portrait asset',
    body: CreatePortraitAssetDto.schema,
    response: PortraitAssetVo,
  })
  @Post('/')
  async create(
    @GetToken() token: TokenInfo,
    @Body() body: CreatePortraitAssetDto,
  ) {
    return this.portraitAssetsService.create(token.id, UserType.User, body)
  }

  @ApiDoc({
    summary: 'Refresh private portrait asset status',
    response: PortraitAssetVo,
  })
  @Post('/:id/refresh')
  async refresh(
    @GetToken() token: TokenInfo,
    @Param('id') id: string,
  ) {
    return this.portraitAssetsService.refresh(token.id, UserType.User, id)
  }
}
