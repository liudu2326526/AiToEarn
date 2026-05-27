import { BadRequestException, Injectable } from '@nestjs/common'
import { UserType } from '@yikart/common'
import { AssetRepository, PortraitAsset, PortraitAssetRepository, PortraitAssetStatus } from '@yikart/mongodb'
import axios from 'axios'
import { CreatePortraitAssetDto, ListPortraitAssetsDto } from './portrait-assets.dto'
import { PortraitAssetListVo, PortraitAssetVo } from './portrait-assets.vo'
import { VolcengineArkAssetService } from './volcengine-ark-asset.service'

const MAX_IMAGE_SIZE = 30 * 1024 * 1024
const MIN_SIDE = 300
const MAX_SIDE = 6000
const MIN_RATIO = 0.4
const MAX_RATIO = 2.5
const MAX_VOLCENGINE_ASSET_NAME_LENGTH = 64

interface ImageDimensions {
  width: number
  height: number
}

@Injectable()
export class PortraitAssetsService {
  constructor(
    private readonly portraitAssetRepo: PortraitAssetRepository,
    private readonly assetRepo: AssetRepository,
    private readonly arkAssetService: VolcengineArkAssetService,
  ) {}

  private toVo(asset: Partial<PortraitAsset>): PortraitAssetVo {
    return {
      id: asset.id!,
      sourceAssetId: asset.sourceAssetId,
      sourceUrl: asset.sourceUrl!,
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      projectName: asset.projectName,
      volcAssetGroupId: asset.volcAssetGroupId,
      volcAssetId: asset.volcAssetId,
      assetUri: asset.assetUri,
      status: asset.status!,
      failureReason: asset.failureReason,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    } as PortraitAssetVo
  }

  private parseDimensions(data: Buffer): ImageDimensions | undefined {
    if (data.length >= 24 && data.toString('ascii', 1, 4) === 'PNG') {
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
    }

    if (data.length >= 10 && (data.toString('ascii', 0, 6) === 'GIF87a' || data.toString('ascii', 0, 6) === 'GIF89a')) {
      return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) }
    }

    if (data.length >= 26 && data.toString('ascii', 0, 2) === 'BM') {
      return { width: Math.abs(data.readInt32LE(18)), height: Math.abs(data.readInt32LE(22)) }
    }

    if (data.length >= 30 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
      const format = data.toString('ascii', 12, 16)
      if (format === 'VP8X' && data.length >= 30) {
        return {
          width: 1 + data.readUIntLE(24, 3),
          height: 1 + data.readUIntLE(27, 3),
        }
      }
      if (format === 'VP8 ' && data.length >= 30) {
        return {
          width: data.readUInt16LE(26) & 0x3fff,
          height: data.readUInt16LE(28) & 0x3fff,
        }
      }
      if (format === 'VP8L' && data.length >= 25) {
        const bits = data.readUInt32LE(21)
        return {
          width: (bits & 0x3fff) + 1,
          height: ((bits >> 14) & 0x3fff) + 1,
        }
      }
    }

    if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
      let offset = 2
      while (offset + 9 < data.length) {
        if (data[offset] !== 0xff) {
          offset++
          continue
        }
        const marker = data[offset + 1]
        const length = data.readUInt16BE(offset + 2)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) }
        }
        offset += 2 + length
      }
    }

    return undefined
  }

  private async fetchDimensions(url: string): Promise<ImageDimensions | undefined> {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        headers: { Range: 'bytes=0-65535' },
        timeout: 15000,
      })
      return this.parseDimensions(Buffer.from(response.data))
    }
    catch {
      return undefined
    }
  }

  private validateImage(params: { size?: number, width?: number, height?: number, mimeType?: string }) {
    const { size, width, height, mimeType } = params
    if (size && size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('Portrait image must be smaller than 30MB')
    }

    if (mimeType && !mimeType.startsWith('image/')) {
      throw new BadRequestException('Only image portrait assets are supported')
    }

    if (!width || !height) {
      return
    }

    const minSide = Math.min(width, height)
    const maxSide = Math.max(width, height)
    const ratio = width / height
    if (minSide < MIN_SIDE || maxSide > MAX_SIDE) {
      throw new BadRequestException('Portrait image side length must be between 300 and 6000px')
    }
    if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
      throw new BadRequestException('Portrait image aspect ratio must be between 0.4 and 2.5')
    }
  }

  async list(userId: string, userType: UserType, query: ListPortraitAssetsDto) {
    const { list, total } = await this.portraitAssetRepo.listWithPagination({
      userId,
      userType,
      ...query,
    })
    return new PortraitAssetListVo(list.map(item => this.toVo(item)), total, query.page, query.pageSize)
  }

  private async resolveSource(userId: string, userType: UserType, dto: CreatePortraitAssetDto) {
    if (!dto.sourceAssetId) {
      return dto.url
    }

    const sourceAsset = await this.assetRepo.getByIdAndUserId(dto.sourceAssetId, userId, userType)
    if (!sourceAsset) {
      throw new BadRequestException('Source asset not found')
    }
    return dto.url || sourceAsset.path
  }

  private async getOrCreateGroup(userId: string, userType: UserType) {
    const latest = await this.portraitAssetRepo.getLatestGroupAsset(userId, userType)
    if (latest?.volcAssetGroupId) {
      return latest.volcAssetGroupId
    }

    const group = await this.arkAssetService.createAssetGroup(
      `aitobee-${userId.slice(0, 12)}`,
      'AitoBee private portrait assets',
    )
    return group.id
  }

  private async pollAsset(assetId: string) {
    let latest = await this.arkAssetService.getAsset(assetId)
    for (let i = 0; i < 4 && latest.status !== 'active' && latest.status !== 'failed'; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      latest = await this.arkAssetService.getAsset(assetId)
    }
    return latest
  }

  private getFilenameExtension(filename?: string, sourceUrl?: string) {
    const raw = filename || sourceUrl || ''
    const basename = raw.split(/[?#]/)[0].split(/[\\/]/).pop() || ''
    const match = basename.match(/(\.[a-zA-Z0-9]{1,12})$/)
    return match?.[1]?.toLowerCase() || ''
  }

  private buildVolcengineAssetName(asset: Pick<PortraitAsset, 'id' | 'filename' | 'sourceUrl'>) {
    const extension = this.getFilenameExtension(asset.filename, asset.sourceUrl)
    const baseName = `portrait-${asset.id}`
    const maxBaseLength = MAX_VOLCENGINE_ASSET_NAME_LENGTH - extension.length
    return `${baseName.slice(0, Math.max(1, maxBaseLength))}${extension}`
  }

  private async registerVolcengineAsset(record: Partial<PortraitAsset> & {
    id: string
    userId: string
    userType: UserType
    sourceUrl: string
    status: PortraitAssetStatus
  }) {
    const groupId = record.volcAssetGroupId || await this.getOrCreateGroup(record.userId, record.userType)
    const created = await this.arkAssetService.createAsset(
      groupId,
      record.sourceUrl,
      this.buildVolcengineAssetName(record as PortraitAsset),
    )
    const assetUri = `asset://${created.id}`
    let nextStatus = created.status === 'active' ? PortraitAssetStatus.Active : PortraitAssetStatus.Processing
    let failureReason = created.error
    let rawResponse = created.raw

    if (created.id) {
      const latest = await this.pollAsset(created.id)
      nextStatus = latest.status === 'active'
        ? PortraitAssetStatus.Active
        : latest.status === 'failed'
          ? PortraitAssetStatus.Failed
          : PortraitAssetStatus.Processing
      failureReason = latest.error || failureReason
      rawResponse = latest.raw
    }

    const update: Record<string, any> = {
      $set: {
        volcAssetGroupId: groupId,
        volcAssetId: created.id,
        assetUri,
        status: nextStatus,
        rawResponse,
      },
    }
    if (failureReason) {
      update['$set'].failureReason = failureReason
    }
    else {
      update['$unset'] = { failureReason: '' }
    }

    return await this.portraitAssetRepo.updateById(record.id, update)
  }

  async create(userId: string, userType: UserType, dto: CreatePortraitAssetDto) {
    const sourceUrl = await this.resolveSource(userId, userType, dto)
    const fetchedDimensions = dto.width && dto.height ? undefined : await this.fetchDimensions(sourceUrl)
    const width = dto.width || fetchedDimensions?.width
    const height = dto.height || fetchedDimensions?.height
    this.validateImage({ size: dto.size, width, height, mimeType: dto.mimeType })

    const groupId = await this.getOrCreateGroup(userId, userType)
    const record = await this.portraitAssetRepo.create({
      userId,
      userType,
      sourceAssetId: dto.sourceAssetId,
      sourceUrl,
      filename: dto.filename,
      mimeType: dto.mimeType,
      size: dto.size,
      width,
      height,
      projectName: this.arkAssetService.projectName,
      volcAssetGroupId: groupId,
      status: PortraitAssetStatus.Processing,
    })

    try {
      const updated = await this.registerVolcengineAsset(record)
      return this.toVo(updated || record)
    }
    catch (error: any) {
      const updated = await this.portraitAssetRepo.updateStatus(record.id, PortraitAssetStatus.Failed, {
        failureReason: error.message || 'Failed to register portrait asset',
      })
      return this.toVo(updated || record)
    }
  }

  async refresh(userId: string, userType: UserType, id: string) {
    const record = await this.portraitAssetRepo.getByIdAndUserId(id, userId, userType)
    if (!record) {
      throw new BadRequestException('Portrait asset not found')
    }
    if (!record.volcAssetId) {
      if (record.status !== PortraitAssetStatus.Failed) {
        return this.toVo(record)
      }

      try {
        const updated = await this.registerVolcengineAsset(record)
        return this.toVo(updated || record)
      }
      catch (error: any) {
        const updated = await this.portraitAssetRepo.updateStatus(record.id, PortraitAssetStatus.Failed, {
          failureReason: error.message || 'Failed to register portrait asset',
        })
        return this.toVo(updated || record)
      }
    }

    const latest = await this.arkAssetService.getAsset(record.volcAssetId)
    const status = latest.status === 'active'
      ? PortraitAssetStatus.Active
      : latest.status === 'failed'
        ? PortraitAssetStatus.Failed
        : PortraitAssetStatus.Processing
    const updated = await this.portraitAssetRepo.updateStatus(record.id, status, {
      failureReason: latest.error,
      rawResponse: latest.raw,
      assetUri: record.assetUri || `asset://${record.volcAssetId}`,
    })
    return this.toVo(updated || record)
  }
}
