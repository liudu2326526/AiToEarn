import { InjectModel } from '@nestjs/mongoose'
import { Pagination, UserType } from '@yikart/common'
import { FilterQuery, Model } from 'mongoose'
import { PortraitAssetStatus } from '../enums'
import { PortraitAsset } from '../schemas'
import { BaseRepository } from './base.repository'

export interface ListPortraitAssetsParams extends Pagination {
  userId: string
  userType?: UserType
  status?: PortraitAssetStatus
}

export class PortraitAssetRepository extends BaseRepository<PortraitAsset> {
  constructor(
    @InjectModel(PortraitAsset.name) portraitAssetModel: Model<PortraitAsset>,
  ) {
    super(portraitAssetModel)
  }

  async getByIdAndUserId(id: string, userId: string, userType?: UserType) {
    return await this.findOne({
      _id: id,
      userId,
      ...(userType ? { userType } : {}),
      deletedAt: { $exists: false },
    })
  }

  async listWithPagination(params: ListPortraitAssetsParams) {
    const { page, pageSize, userId, userType, status } = params

    const filter: FilterQuery<PortraitAsset> = {
      userId,
      ...(userType ? { userType } : {}),
      ...(status ? { status } : {}),
      deletedAt: { $exists: false },
    }

    const [list, total] = await this.findWithPagination({
      page,
      pageSize,
      filter,
      options: { sort: { createdAt: -1 } },
    })

    return { list, total }
  }

  async getLatestGroupAsset(userId: string, userType?: UserType) {
    return await this.findOne({
      userId,
      ...(userType ? { userType } : {}),
      volcAssetGroupId: { $exists: true, $ne: null },
      deletedAt: { $exists: false },
    }, { sort: { createdAt: -1 } })
  }

  async updateStatus(id: string, status: PortraitAssetStatus, additionalData?: Partial<PortraitAsset>) {
    return await this.updateById(id, {
      status,
      ...additionalData,
    })
  }
}
