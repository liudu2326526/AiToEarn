import { Injectable } from '@nestjs/common'
import { CommentSnapshotRepository, PostSnapshotRepository } from '@yikart/channel-db'
import { AcquisitionFetchResult, PersistedAcquisitionFetchResult } from './acquisition.types'

@Injectable()
export class SnapshotPersistenceService {
  constructor(
    private readonly postSnapshotRepository: PostSnapshotRepository,
    private readonly commentSnapshotRepository: CommentSnapshotRepository,
  ) {}

  async persistFetchResult(result: AcquisitionFetchResult): Promise<PersistedAcquisitionFetchResult> {
    let postSaved = false
    if (result.post) {
      await this.postSnapshotRepository.createSnapshot(result.post)
      postSaved = true
    }

    const bulkResult = await this.commentSnapshotRepository.bulkUpsertByCommentId(result.comments)
    return {
      ...result,
      postSaved,
      commentsSaved: bulkResult.upsertedCount + bulkResult.modifiedCount,
    }
  }
}
