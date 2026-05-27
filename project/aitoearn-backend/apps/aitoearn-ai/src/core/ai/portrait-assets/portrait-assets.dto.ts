import { createZodDto, PaginationDtoSchema } from '@yikart/common'
import { PortraitAssetStatus } from '@yikart/mongodb'
import { z } from 'zod'

const createPortraitAssetSchema = z.object({
  url: z.string().min(1),
  sourceAssetId: z.string().optional(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

const listPortraitAssetsSchema = PaginationDtoSchema.extend({
  status: z.enum(PortraitAssetStatus).optional(),
})

export class CreatePortraitAssetDto extends createZodDto(createPortraitAssetSchema) {}
export class ListPortraitAssetsDto extends createZodDto(listPortraitAssetsSchema) {}
