import { Module } from '@nestjs/common'
import { config } from '../../../config'
import { VolcengineModule } from '../libs/volcengine'
import { PortraitAssetsController } from './portrait-assets.controller'
import { PortraitAssetsService } from './portrait-assets.service'
import { VolcengineArkAssetService } from './volcengine-ark-asset.service'

@Module({
  imports: [VolcengineModule.forRoot(config.ai.volcengine)],
  controllers: [PortraitAssetsController],
  providers: [PortraitAssetsService, VolcengineArkAssetService],
  exports: [PortraitAssetsService],
})
export class PortraitAssetsModule {}
