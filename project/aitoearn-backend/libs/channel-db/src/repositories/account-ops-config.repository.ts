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

  async upsertByAccountId(userId: string, accountId: string, data: Partial<AccountOpsConfig>) {
    return await this.updateOne(
      { userId, accountId },
      {
        $set: { ...data, userId },
        $setOnInsert: { accountId },
      },
      { upsert: true },
    )
  }

  async getByAccountId(userId: string, accountId: string) {
    return await this.accountOpsConfigModel.findOne({ userId, accountId }).lean({ virtuals: true }).exec()
  }

  async listByUser(userId: string) {
    return await this.accountOpsConfigModel.find({ userId }, undefined, { sort: { updatedAt: -1 } }).lean({ virtuals: true }).exec()
  }

  async dropLegacyAccountIdUniqueIndex() {
    const indexes = await this.accountOpsConfigModel.collection.indexes()
    const legacyIndex = indexes.find(index => (
      index.name === 'accountId_1'
      && index.unique === true
      && index.key
      && Object.keys(index.key).length === 1
      && index.key['accountId'] === 1
    ))

    if (!legacyIndex)
      return false

    await this.accountOpsConfigModel.collection.dropIndex('accountId_1')
    return true
  }

  async updateCommentCapability(
    userId: string,
    accountId: string,
    status: CommentFetchCapabilityStatus,
    reason = '',
    meta: Record<string, unknown> = {},
  ) {
    return await this.upsertByAccountId(userId, accountId, {
      commentFetchStatus: status,
      commentFetchStatusReason: reason,
      commentFetchCheckedAt: new Date(),
      commentFetchMeta: meta,
    })
  }
}
