import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { Lead } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class LeadRepository extends BaseRepository<Lead> {
  constructor(
    @InjectModel(Lead.name, DB_CONNECTION_NAME) private leadModel: Model<Lead>,
  ) {
    super(leadModel)
  }
}
