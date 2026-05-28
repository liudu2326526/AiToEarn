import { describe, expect, it } from 'vitest'
import { SensitiveWordService } from './sensitive-word.service'

describe('SensitiveWordService', () => {
  const service = new SensitiveWordService()

  it('blocks WeChat variants in public text', () => {
    expect(service.check('加我v信abc')).toEqual({
      passed: false,
      hits: ['加我', 'v信'],
    })
  })

  it('blocks phone numbers', () => {
    const result = service.check('联系 13812345678')
    expect(result.passed).toBe(false)
    expect(result.hits).toContain('13812345678')
  })

  it('blocks URLs', () => {
    const result = service.check('更多信息看 https://example.com/a')
    expect(result.passed).toBe(false)
    expect(result.hits).toContain('https://example.com/a')
  })

  it('supports account custom words', () => {
    expect(service.check('这件衣服可以走私域', ['私域'])).toEqual({
      passed: false,
      hits: ['私域'],
    })
  })

  it('passes normal public replies', () => {
    expect(service.check('可以私信我，我发你尺码建议')).toEqual({
      passed: true,
      hits: [],
    })
  })
})
