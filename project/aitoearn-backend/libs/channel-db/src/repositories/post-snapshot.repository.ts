import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { PostSnapshot } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class PostSnapshotRepository extends BaseRepository<PostSnapshot> {
  constructor(
    @InjectModel(PostSnapshot.name, DB_CONNECTION_NAME) private postSnapshotModel: Model<PostSnapshot>,
  ) {
    super(postSnapshotModel)
  }
}
