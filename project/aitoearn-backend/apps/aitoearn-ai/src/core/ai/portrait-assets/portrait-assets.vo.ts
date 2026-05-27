import { createZodDto } from '@yikart/common'
import { PortraitAssetStatus } from '@yikart/mongodb'
import { z } from 'zod'

export const portraitAssetSchema = z.object({
  id: z.string(),
  sourceAssetId: z.string().optional(),
  sourceUrl: z.string(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  projectName: z.string().optional(),
  volcAssetGroupId: z.string().optional(),
  volcAssetId: z.string().optional(),
  assetUri: z.string().optional(),
  status: z.enum(PortraitAssetStatus),
  failureReason: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export class PortraitAssetVo extends createZodDto(portraitAssetSchema) {}

export class PortraitAssetListVo {
  constructor(
    public readonly list: PortraitAssetVo[],
    public readonly total: number,
    public readonly page: number,
    public readonly pageSize: number,
  ) {}
}
