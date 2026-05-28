import { Injectable } from '@nestjs/common'
import { PLATFORM_CONTENT_LIMITS } from './acquisition-content.constants'

export interface PlatformContentInput {
  platform: keyof typeof PLATFORM_CONTENT_LIMITS
  title: string
  body: string
  topics: string[]
}

@Injectable()
export class PlatformContentAdapterService {
  normalize(input: PlatformContentInput): PlatformContentInput {
    const limits = PLATFORM_CONTENT_LIMITS[input.platform]
    return {
      platform: input.platform,
      title: this.truncate(input.title.trim(), limits.titleMax),
      body: this.truncate(input.body.trim(), limits.bodyMax),
      topics: Array.from(new Set(input.topics.map(topic => topic.replace(/^#/, '').trim()).filter(Boolean))).slice(0, limits.topicMax),
    }
  }

  private truncate(value: string, max: number) {
    return value.length > max ? value.slice(0, max) : value
  }
}
