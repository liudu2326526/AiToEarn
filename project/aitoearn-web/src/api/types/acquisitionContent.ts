export type AcquisitionPlatform = 'xhs' | 'douyin' | 'kwai'
export type AcquisitionContentStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'published'
  | 'publish_failed'
  | 'generation_failed'

export interface AcquisitionPlatformContent {
  platform: AcquisitionPlatform
  accountId?: string
  title: string
  body: string
  topics: string[]
  suggestedPublishAt?: string
  hook?: {
    hookTemplateId?: string
    content?: string
    category?: string
  }
  strategyNote?: string
  publishRecordId?: string
}

export interface AcquisitionContent {
  id: string
  userId: string
  productName: string
  productCategory: string
  priceRange?: string
  sizeRange?: string
  sellingPoints?: string
  contentStyle?: string
  referenceImageUrls: string[]
  targetPlatforms: AcquisitionPlatform[]
  status: AcquisitionContentStatus
  platformContents: AcquisitionPlatformContent[]
  draftTaskIds: string[]
  generatedByModel?: string
  failureReason?: string
  reviewNote?: string
  createdAt: string
  updatedAt: string
}

export interface GenerateAcquisitionContentPayload {
  accountIds: string[]
  platforms: AcquisitionPlatform[]
  productName: string
  productCategory: string
  priceRange?: string
  sizeRange?: string
  sellingPoints: string
  contentStyle?: string
  referenceImageUrls: string[]
  autoAttachHook: boolean
  generateMedia: boolean
  mediaMode: 'image_text' | 'video'
  chatModel?: string
  model?: string
  imageModel?: string
}
