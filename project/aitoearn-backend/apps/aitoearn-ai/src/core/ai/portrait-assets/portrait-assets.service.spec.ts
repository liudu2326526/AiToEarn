import type { AssetRepository, PortraitAssetRepository } from '@yikart/mongodb'
import { UserType } from '@yikart/common'
import { PortraitAssetStatus } from '@yikart/mongodb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PortraitAssetsService } from './portrait-assets.service'
import { VolcengineArkAssetService } from './volcengine-ark-asset.service'

vi.mock('@yikart/mongodb', () => ({
  AssetRepository: class {},
  PortraitAssetRepository: class {},
  PortraitAssetStatus: {
    Active: 'active',
    Failed: 'failed',
    Pending: 'pending',
    Processing: 'processing',
  },
}))

describe('PortraitAssetsService', () => {
  let service: PortraitAssetsService
  let portraitAssetRepo: {
    create: ReturnType<typeof vi.fn>
    getByIdAndUserId: ReturnType<typeof vi.fn>
    getLatestGroupAsset: ReturnType<typeof vi.fn>
    listWithPagination: ReturnType<typeof vi.fn>
    updateById: ReturnType<typeof vi.fn>
    updateStatus: ReturnType<typeof vi.fn>
  }
  let assetRepo: {
    getByIdAndUserId: ReturnType<typeof vi.fn>
  }
  let arkAssetService: {
    projectName: string
    createAsset: ReturnType<typeof vi.fn>
    createAssetGroup: ReturnType<typeof vi.fn>
    getAsset: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    portraitAssetRepo = {
      create: vi.fn(async data => ({ id: 'portrait-record-1', ...data })),
      getByIdAndUserId: vi.fn(),
      getLatestGroupAsset: vi.fn(async () => ({ volcAssetGroupId: 'group-1' })),
      listWithPagination: vi.fn(),
      updateById: vi.fn(async (id, data) => {
        const set = data.$set || data
        return {
          id,
          sourceUrl: 'https://cdn.example.com/image.png',
          ...set,
          failureReason: data.$unset?.failureReason ? undefined : set.failureReason,
        }
      }),
      updateStatus: vi.fn(async (id, status, data) => ({ id, sourceUrl: 'https://cdn.example.com/image.png', status, ...data })),
    }
    assetRepo = {
      getByIdAndUserId: vi.fn(),
    }
    arkAssetService = {
      projectName: 'default',
      createAsset: vi.fn(async () => ({ id: 'volc-asset-1', status: 'active', raw: { ok: true } })),
      createAssetGroup: vi.fn(),
      getAsset: vi.fn(async () => ({ id: 'volc-asset-1', status: 'active', raw: { ok: true } })),
    }
    service = new PortraitAssetsService(
      portraitAssetRepo as unknown as PortraitAssetRepository,
      assetRepo as unknown as AssetRepository,
      arkAssetService as unknown as VolcengineArkAssetService,
    )
  })

  it('uses a Volcengine asset name no longer than 64 characters', async () => {
    const longFilename = '6a165b3263c819c7d13ed750/76bfe5dc02aa49f85c21ab856332de0f987379c79b44f89fdfa6a9a3ab522094.png'

    await service.create('user-1', UserType.User, {
      url: 'https://cdn.example.com/portraits/image.png',
      filename: longFilename,
      mimeType: 'image/png',
      width: 518,
      height: 574,
      size: 1024,
    })

    const [, , name] = arkAssetService.createAsset.mock.calls[0]
    expect(name).toBeTruthy()
    expect(name.length).toBeLessThanOrEqual(64)
    expect(name.endsWith('.png')).toBe(true)
  })

  it('re-registers a failed portrait asset that has no Volcengine asset id', async () => {
    portraitAssetRepo.getByIdAndUserId.mockResolvedValue({
      id: 'portrait-record-1',
      userId: 'user-1',
      userType: UserType.User,
      sourceUrl: 'https://cdn.example.com/portraits/image.png',
      filename: '6a165b3263c819c7d13ed750/76bfe5dc02aa49f85c21ab856332de0f987379c79b44f89fdfa6a9a3ab522094.png',
      mimeType: 'image/png',
      width: 518,
      height: 574,
      size: 1024,
      projectName: 'default',
      volcAssetGroupId: 'group-1',
      status: PortraitAssetStatus.Failed,
      failureReason: 'Volcengine asset API error: InvalidParameter.Name',
    })

    const result = await service.refresh('user-1', UserType.User, 'portrait-record-1')

    expect(arkAssetService.createAsset).toHaveBeenCalledTimes(1)
    const [, , name] = arkAssetService.createAsset.mock.calls[0]
    expect(name.length).toBeLessThanOrEqual(64)
    expect(portraitAssetRepo.updateById).toHaveBeenCalledWith('portrait-record-1', expect.objectContaining({
      $set: expect.objectContaining({
        volcAssetId: 'volc-asset-1',
        assetUri: 'asset://volc-asset-1',
        status: PortraitAssetStatus.Active,
      }),
      $unset: { failureReason: '' },
    }))
    expect(result.status).toBe(PortraitAssetStatus.Active)
  })
})
