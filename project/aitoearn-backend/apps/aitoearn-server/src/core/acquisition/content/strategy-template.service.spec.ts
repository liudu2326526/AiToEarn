import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HookTemplateCategory, ScriptTemplateRiskLevel, ScriptTemplateScene } from '@yikart/channel-db'
import { ResponseCode } from '@yikart/common'
import { StrategyTemplateService } from './strategy-template.service'

describe('StrategyTemplateService', () => {
  const hookTemplateRepository = {
    create: vi.fn(),
    getByName: vi.fn(),
  }
  const scriptTemplateRepository = {
    create: vi.fn(),
    getByName: vi.fn(),
  }
  const accountOpsConfigRepository = {
    upsertByAccountId: vi.fn(),
  }
  const sensitiveWordService = {
    check: vi.fn(),
  }
  const service = new StrategyTemplateService(
    hookTemplateRepository as any,
    scriptTemplateRepository as any,
    accountOpsConfigRepository as any,
    sensitiveWordService as any,
  )

  beforeEach(() => vi.clearAllMocks())

  it('blocks public hook templates that contain wechat words', async () => {
    sensitiveWordService.check.mockReturnValue({ passed: false, hits: ['微信'] })

    await expect(service.createHookTemplate('user-1', {
      name: '加微信钩子',
      category: HookTemplateCategory.WechatGuide,
      content: '加我微信领取福利',
      weight: 1,
      enabled: true,
      applicablePlatforms: ['xhs'],
      applicableCategories: ['裙子'],
      applicableAccountIds: [],
    } as any)).rejects.toMatchObject({ code: ResponseCode.ValidationFailed })
  })

  it('allows private wechat script only when allowWechatId is true', async () => {
    sensitiveWordService.check.mockReturnValue({ passed: false, hits: ['微信'] })
    scriptTemplateRepository.create.mockResolvedValue({ id: 'script-1' })

    const result = await service.createScriptTemplate('user-1', {
      name: '私信第三轮',
      scene: ScriptTemplateScene.PrivateMessageWechatGuide,
      content: '可以加微信 {wechat_id} 给你发尺码表',
      variables: ['wechat_id'],
      enabled: true,
      applicableCategories: ['裙子'],
      riskLevel: ScriptTemplateRiskLevel.High,
      platformConstraints: {
        allowWechatId: true,
        requireManualConfirm: true,
        blockedPlatforms: [],
      },
    } as any)

    expect(result.id).toBe('script-1')
  })
})
