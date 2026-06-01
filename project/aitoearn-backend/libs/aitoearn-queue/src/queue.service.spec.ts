import { describe, expect, it, vi } from 'vitest'
import { QueueService } from './queue.service'

function createQueueService(xhsTokenRefreshQueue: any) {
  const queue = {
    add: vi.fn(),
    getJob: vi.fn(),
    getWaiting: vi.fn(),
  }

  return new QueueService(
    { jobOptions: {} } as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    queue as any,
    xhsTokenRefreshQueue,
  )
}

describe('QueueService XHS token refresh jobs', () => {
  it('uses BullMQ-safe custom ids when adding and removing token refresh jobs', async () => {
    const xhsTokenRefreshQueue = {
      add: vi.fn((_name: string, _data: unknown, options: { jobId?: string }) => {
        if (options.jobId?.includes(':')) {
          throw new Error('Custom Id cannot contain :')
        }
        return { id: options.jobId }
      }),
      getJob: vi.fn(),
      getWaiting: vi.fn(),
    }
    const service = createQueueService(xhsTokenRefreshQueue)

    await expect(service.addXhsTokenRefreshJob({
      publishRecordId: '6a1d3c86d68b4a608db5d89f',
      monitoredPostId: '6a1d3cda401c5084109dca2d',
      userId: '6a0fc3e5eef0b17d7f969d9f',
      noteId: '6a1d3c980000000007021dc1',
    })).resolves.toEqual({ id: 'xhs-token-6a1d3c86d68b4a608db5d89f' })

    await service.removeXhsTokenRefreshJob('6a1d3c86d68b4a608db5d89f')

    expect(xhsTokenRefreshQueue.add).toHaveBeenCalledWith(
      'refresh-token',
      expect.objectContaining({ publishRecordId: '6a1d3c86d68b4a608db5d89f' }),
      expect.objectContaining({ jobId: 'xhs-token-6a1d3c86d68b4a608db5d89f' }),
    )
    expect(xhsTokenRefreshQueue.getJob).toHaveBeenCalledWith('xhs-token-6a1d3c86d68b4a608db5d89f')
  })

  it('does not dispatch token refresh jobs that already hit the retry window limit', async () => {
    const freshJob = {
      data: {
        publishRecordId: 'fresh-record',
        userId: 'user-1',
        noteId: 'fresh-note-id',
        processingAt: Date.now(),
        processingCount: 2,
      },
      updateData: vi.fn(),
    }
    const exhaustedJob = {
      data: {
        publishRecordId: 'exhausted-record',
        userId: 'user-1',
        noteId: 'exhausted-note-id',
        processingAt: Date.now(),
        processingCount: 3,
      },
      updateData: vi.fn(),
    }
    const xhsTokenRefreshQueue = {
      add: vi.fn(),
      getJob: vi.fn(),
      getWaiting: vi.fn().mockResolvedValue([freshJob, exhaustedJob]),
    }
    const service = createQueueService(xhsTokenRefreshQueue)

    await expect(service.getXhsTokenRefreshJobs('user-1')).resolves.toEqual([
      expect.objectContaining({ publishRecordId: 'fresh-record' }),
    ])

    expect(freshJob.updateData).toHaveBeenCalledWith(expect.objectContaining({
      publishRecordId: 'fresh-record',
      processingCount: 3,
    }))
    expect(exhaustedJob.updateData).not.toHaveBeenCalled()
  })

  it('resets exhausted token refresh jobs after the stale cooldown', async () => {
    const staleJob = {
      data: {
        publishRecordId: 'stale-record',
        userId: 'user-1',
        noteId: 'stale-note-id',
        processingAt: Date.now() - 11 * 60 * 1000,
        processingCount: 3,
      },
      updateData: vi.fn(),
    }
    const xhsTokenRefreshQueue = {
      add: vi.fn(),
      getJob: vi.fn(),
      getWaiting: vi.fn().mockResolvedValue([staleJob]),
    }
    const service = createQueueService(xhsTokenRefreshQueue)

    await expect(service.cleanupStaleXhsTokenRefreshJobs()).resolves.toBe(1)

    expect(staleJob.updateData).toHaveBeenCalledWith(expect.objectContaining({
      publishRecordId: 'stale-record',
      processingAt: undefined,
      processingCount: 0,
    }))
  })
})
