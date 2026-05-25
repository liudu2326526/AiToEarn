import { Module } from '@nestjs/common'
import { MetricEventHelperModule } from '@yikart/helpers'
import { PromotionMarketplaceController } from './promotion-marketplace.controller'
import { PromotionMarketplaceService } from './promotion-marketplace.service'

@Module({
  imports: [MetricEventHelperModule],
  controllers: [PromotionMarketplaceController],
  providers: [PromotionMarketplaceService],
})
export class PromotionMarketplaceModule {}
