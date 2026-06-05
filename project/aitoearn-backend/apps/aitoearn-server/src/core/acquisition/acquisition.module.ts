import { Module } from '@nestjs/common'
import { AitoearnAiClientModule } from '@yikart/aitoearn-ai-client'
import { ChannelDbModule } from '@yikart/channel-db'
import { DouyinApiModule } from '../channel/libs/douyin/douyin-api.module'
import { ChannelSharedModule } from '../channel/platforms/channel-shared.module'
import { DouyinModule } from '../channel/platforms/douyin/douyin.module'
import { PublishModule } from '../channel/publishing/publishing.module'
import { SensitiveWordModule } from '../sensitive-word/sensitive-word.module'
import { XhsBridgeModule } from '../xhs-bridge/xhs-bridge.module'
import { ACQUISITION_PROVIDERS, AcquisitionPlatform } from './acquisition.constants'
import { AcquisitionController } from './acquisition.controller'
import { AcquisitionService } from './acquisition.service'
import { CommentCapabilityService } from './comment-capability.service'
import { AcquisitionContentController } from './content/acquisition-content.controller'
import { ContentGenerationService } from './content/content-generation.service'
import { ContentReviewService } from './content/content-review.service'
import { ContentScheduleService } from './content/content-schedule.service'
import { HookSelectionService } from './content/hook-selection.service'
import { PlatformContentAdapterService } from './content/platform-content-adapter.service'
import { StrategyTemplateService } from './content/strategy-template.service'
import { DouyinCreatorAutomationController } from './douyin-creator-automation/douyin-creator-automation.controller'
import { DouyinCreatorAutomationModule } from './douyin-creator-automation/douyin-creator-automation.module'
import { AcquisitionLeadsController } from './leads/acquisition-leads.controller'
import { LeadManagementService } from './leads/lead-management.service'
import { LeadMaterializationService } from './leads/lead-materialization.service'
import { DouyinCreatorReplyAdapter } from './leads/platform-reply-adapters/douyin-creator-reply.adapter'
import { PlatformReplyAdapterRegistry } from './leads/platform-reply-adapters/registry'
import { XhsBrowserPluginReplyAdapter } from './leads/platform-reply-adapters/xhs-browser-plugin-reply.adapter'
import { ReplyAutomationService } from './leads/reply-automation.service'
import { ReplyExecutionService } from './leads/reply-execution.service'
import { ReplySuggestionService } from './leads/reply-suggestion.service'
import { ReplyTaskExecutorService } from './leads/reply-task-executor.service'
import { ReplyTaskScreenshotService } from './leads/reply-task-screenshot.service'
import { DouyinAcquisitionProvider } from './providers/douyin/douyin-acquisition.provider'
import { XhsBridgeAcquisitionProvider } from './providers/xhs/xhs-bridge-acquisition.provider'
import { SnapshotPersistenceService } from './snapshot-persistence.service'
import { WorkDataController } from './work-data/work-data.controller'
import { WorkDataService } from './work-data/work-data.service'
import { AcquisitionCommentFetchConsumer } from './workers/acquisition-comment-fetch.consumer'
import { AcquisitionPostBackfillConsumer } from './workers/acquisition-post-backfill.consumer'
import { LeadReplyTaskConsumer } from './workers/lead-reply-task.consumer'
import { XhsTokenRefreshService } from './xhs-token-refresh.service'

@Module({
  imports: [
    XhsBridgeModule,
    DouyinModule,
    DouyinApiModule,
    ChannelDbModule,
    SensitiveWordModule,
    AitoearnAiClientModule,
    PublishModule,
    ChannelSharedModule,
    DouyinCreatorAutomationModule,
  ],
  controllers: [
    AcquisitionController,
    AcquisitionContentController,
    WorkDataController,
    AcquisitionLeadsController,
    DouyinCreatorAutomationController,
  ],
  providers: [
    AcquisitionService,
    SnapshotPersistenceService,
    CommentCapabilityService,
    XhsBridgeAcquisitionProvider,
    DouyinAcquisitionProvider,
    AcquisitionCommentFetchConsumer,
    AcquisitionPostBackfillConsumer,
    LeadReplyTaskConsumer,
    PlatformContentAdapterService,
    HookSelectionService,
    ContentGenerationService,
    ContentReviewService,
    ContentScheduleService,
    StrategyTemplateService,
    WorkDataService,
    LeadMaterializationService,
    LeadManagementService,
    ReplySuggestionService,
    ReplyExecutionService,
    ReplyAutomationService,
    ReplyTaskExecutorService,
    ReplyTaskScreenshotService,
    XhsBrowserPluginReplyAdapter,
    DouyinCreatorReplyAdapter,
    PlatformReplyAdapterRegistry,
    XhsTokenRefreshService,
    {
      provide: ACQUISITION_PROVIDERS,
      useFactory: (
        xhsProvider: XhsBridgeAcquisitionProvider,
        douyinProvider: DouyinAcquisitionProvider,
      ) => ({
        [AcquisitionPlatform.Xhs]: xhsProvider,
        [AcquisitionPlatform.Douyin]: douyinProvider,
      }),
      inject: [XhsBridgeAcquisitionProvider, DouyinAcquisitionProvider],
    },
  ],
  exports: [AcquisitionService],
})
export class AcquisitionModule {}
