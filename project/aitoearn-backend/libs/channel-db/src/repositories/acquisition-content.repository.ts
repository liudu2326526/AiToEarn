import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, RootFilterQuery } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { AcquisitionContent, AcquisitionContentStatus } from '../schemas/acquisition-content.schema'
import { BaseRepository } from './base.repository'

@Injectable()
export class AcquisitionContentRepository extends BaseRepository<AcquisitionContent> {
  constructor(
    @InjectModel(AcquisitionContent.name, DB_CONNECTION_NAME)
    private readonly acquisitionContentModel: Model<AcquisitionContent>,
  ) {
    super(acquisitionContentModel)
  }

  async createByUser(data: Partial<AcquisitionContent> & { userId: string }) {
    return await this.acquisitionContentModel.create(data)
  }

  async listByUser(query: {
    userId: string
    status?: AcquisitionContentStatus
    platform?: string
    productCategory?: string
    page: number
    pageSize: number
  }) {
    const filter: RootFilterQuery<AcquisitionContent> = {
      userId: query.userId,
      ...(query.status && { status: query.status }),
      ...(query.productCategory && { productCategory: query.productCategory }),
      ...(query.platform && { targetPlatforms: query.platform }),
    }
    const skip = (query.page - 1) * query.pageSize
    const [list, total] = await Promise.all([
      this.acquisitionContentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.pageSize).lean({ virtuals: true }).exec(),
      this.acquisitionContentModel.countDocuments(filter).exec(),
    ])
    return [list, total] as const
  }

  async getByIdAndUserId(id: string, userId: string) {
    return await this.acquisitionContentModel.findOne({ _id: id, userId }).lean({ virtuals: true }).exec()
  }

  async updateStatusById(id: string, userId: string, status: AcquisitionContentStatus, extra: Partial<AcquisitionContent> = {}) {
    return await this.acquisitionContentModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { status, ...extra }, $inc: { version: 1 } },
      { new: true },
    ).lean({ virtuals: true }).exec()
  }

  async updatePlatformContentsById(id: string, userId: string, platformContents: AcquisitionContent['platformContents']) {
    return await this.acquisitionContentModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { platformContents }, $inc: { version: 1 } },
      { new: true },
    ).lean({ virtuals: true }).exec()
  }
}
