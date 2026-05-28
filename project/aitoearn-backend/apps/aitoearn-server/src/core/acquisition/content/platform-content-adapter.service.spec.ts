import { describe, expect, it } from 'vitest'
import { PlatformContentAdapterService } from './platform-content-adapter.service'

describe('PlatformContentAdapterService', () => {
  const service = new PlatformContentAdapterService()

  it('truncates XHS title and topics to platform limits', () => {
    const result = service.normalize({
      platform: 'xhs',
      title: '这是一条超过二十个字的小红书标题需要截断',
      body: '适合通勤的针织裙',
      topics: ['通勤穿搭', '显瘦', '小个子', '裙子', 'ootd', '多余'],
    })

    expect(result.title.length).toBeLessThanOrEqual(20)
    expect(result.topics).toHaveLength(5)
  })
})
