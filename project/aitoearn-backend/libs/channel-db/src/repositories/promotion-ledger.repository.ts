import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { PromotionLedger, PromotionLedgerStatus } from '../schemas'
import { BaseRepository, LeanDoc } from './base.repository'

@Injectable()
export class PromotionLedgerRepository extends BaseRepository<PromotionLedger> {
  constructor(
    @InjectModel(PromotionLedger.name, DB_CONNECTION_NAME) private promotionLedgerModel: Model<PromotionLedger>,
  ) {
    super(promotionLedgerModel)
  }

  async createLedger(data: Partial<PromotionLedger>): Promise<LeanDoc<PromotionLedger>> {
    return this.create(data)
  }

  async listLedger(userId: string, page = 1, pageSize = 20): Promise<readonly [LeanDoc<PromotionLedger>[], number]> {
    return this.findWithPagination({
      page,
      pageSize,
      filter: { userId },
      options: { sort: { createdAt: -1 } },
    })
  }

  async sumByUserAndStatus(userId: string, status: PromotionLedgerStatus): Promise<number> {
    const result = await this.promotionLedgerModel.aggregate<{ total: number }>([
      { $match: { userId, status } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).exec()
    return result[0]?.total ?? 0
  }
}
