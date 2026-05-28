import { Module } from '@nestjs/common'
import { XhsBridgeService } from './xhs-bridge.service'

@Module({
  providers: [XhsBridgeService],
  exports: [XhsBridgeService],
})
export class XhsBridgeModule {}
