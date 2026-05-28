import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { CommentSnapshot } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class CommentSnapshotRepository extends BaseRepository<CommentSnapshot> {
  constructor(
    @InjectModel(CommentSnapshot.name, DB_CONNECTION_NAME) private commentSnapshotModel: Model<CommentSnapshot>,
  ) {
    super(commentSnapshotModel)
  }
}
