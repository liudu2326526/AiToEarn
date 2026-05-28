export const ACQUISITION_PLATFORM_VALUES = ['xhs', 'douyin', 'kwai'] as const
export const ACQUISITION_CONTENT_STATUS_VALUES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'scheduled',
  'published',
  'publish_failed',
  'generation_failed',
] as const

export const ACQUISITION_REPLY_TONE_VALUES = ['friendly', 'professional', 'promotion', 'restrained'] as const

export const PLATFORM_CONTENT_LIMITS = {
  xhs: { titleMax: 20, bodyMax: 1000, topicMax: 5, supportsImageText: true, supportsVideo: true },
  douyin: { titleMax: 80, bodyMax: 2000, topicMax: 10, supportsImageText: false, supportsVideo: true },
  kwai: { titleMax: 80, bodyMax: 500, topicMax: 4, supportsImageText: false, supportsVideo: true },
} as const
