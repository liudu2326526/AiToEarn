import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { AccountOpsConfig, CommentFetchCapabilityStatus } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class AccountOpsConfigRepository extends BaseRepository<AccountOpsConfig> {
  constructor(
    @InjectModel(AccountOpsConfig.name, DB_CONNECTION_NAME) private accountOpsConfigModel: Model<AccountOpsConfig>,
  ) {
    super(accountOpsConfigModel)
  }

  async upsertByAccountId(accountId: string, data: Partial<AccountOpsConfig>) {
    return await this.updateOne(
      { accountId },
      {
        $set: data,
        $setOnInsert: { accountId },
      },
      { upsert: true },
    )
  }

  async getByAccountId(accountId: string) {
    return await this.accountOpsConfigModel.findOne({ accountId }).lean({ virtuals: true }).exec()
  }

  async updateCommentCapability(
    accountId: string,
    status: CommentFetchCapabilityStatus,
    reason = '',
    meta: Record<string, unknown> = {},
  ) {
    return await this.upsertByAccountId(accountId, {
      commentFetchStatus: status,
      commentFetchStatusReason: reason,
      commentFetchCheckedAt: new Date(),
      commentFetchMeta: meta,
    })
  }
}
