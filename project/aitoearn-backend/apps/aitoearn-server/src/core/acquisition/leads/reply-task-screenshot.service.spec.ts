import { AppException, ResponseCode } from '@yikart/common'
import { AssetType } from '@yikart/mongodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReplyTaskScreenshotService } from './reply-task-screenshot.service'

describe('ReplyTaskScreenshotService', () => {
  const assetsService = {
    uploadFromBuffer: vi.fn(),
  }

  let service: ReplyTaskScreenshotService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ReplyTaskScreenshotService(assetsService as any)
  })

  it('returns empty string for missing screenshot data', async () => {
    await expect(service.uploadScreenshot('user-1', 'task-1', '')).resolves.toBe('')
    expect(assetsService.uploadFromBuffer).not.toHaveBeenCalled()
  })

  it('rejects non-image data urls', async () => {
    await expect(service.uploadScreenshot('user-1', 'task-1', 'data:text/plain;base64,aGVsbG8='))
      .rejects.toMatchObject(new AppException(ResponseCode.ValidationFailed, 'Invalid screenshot data URL'))
    expect(assetsService.uploadFromBuffer).not.toHaveBeenCalled()
  })

  it('rejects screenshots larger than the configured cap', async () => {
    const oversized = Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64')

    await expect(service.uploadScreenshot('user-1', 'task-1', `data:image/png;base64,${oversized}`))
      .rejects.toMatchObject(new AppException(ResponseCode.AssetTooLarge, 'Screenshot is too large'))
    expect(assetsService.uploadFromBuffer).not.toHaveBeenCalled()
  })

  it('uploads a png screenshot through AssetsService and returns the asset url', async () => {
    assetsService.uploadFromBuffer.mockResolvedValue({ url: 'https://obs.example.com/task-1.png' })

    const result = await service.uploadScreenshot(
      'user-1',
      'task-1',
      `data:image/png;base64,${Buffer.from('png-data').toString('base64')}`,
    )

    expect(result).toBe('https://obs.example.com/task-1.png')
    expect(assetsService.uploadFromBuffer).toHaveBeenCalledWith(
      'user-1',
      Buffer.from('png-data'),
      {
        type: AssetType.Temp,
        mimeType: 'image/png',
        filename: 'task-1.png',
      },
      'lead-reply-task/task-1',
    )
  })
})
