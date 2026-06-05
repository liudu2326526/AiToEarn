import { Module } from '@nestjs/common'
import { ChannelDbModule } from '@yikart/channel-db'
import { config } from '../../../config'
import { DouyinCreatorAutomationService } from './douyin-creator-automation.service'
import { DouyinCreatorCliService } from './douyin-creator-cli.service'

@Module({
  imports: [ChannelDbModule],
  providers: [
    DouyinCreatorAutomationService,
    {
      provide: DouyinCreatorCliService,
      useFactory: () => new DouyinCreatorCliService(config.douyinCreatorAutomation),
    },
  ],
  exports: [DouyinCreatorAutomationService, DouyinCreatorCliService],
})
export class DouyinCreatorAutomationModule {}
