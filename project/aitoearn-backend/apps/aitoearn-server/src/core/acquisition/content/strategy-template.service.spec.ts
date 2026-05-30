import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HookTemplateCategory, ScriptTemplateRiskLevel, ScriptTemplateScene } from '@yikart/channel-db'
import { ResponseCode } from '@yikart/common'
import { StrategyTemplateService } from './strategy-template.service'

describe('StrategyTemplateService', () => {
  const hookTemplateRepository = {
    create: vi.fn(),
    getByName: vi.fn(),
    listByUser: vi.fn(),
    getByIdAndUser: vi.fn(),
    updateByIdAndUser: vi.fn(),
    deleteByIdAndUser: vi.fn(),
  }
  const scriptTemplateRepository = {
    create: vi.fn(),
    getByName: vi.fn(),
    listByUser: vi.fn(),
    getByIdAndUser: vi.fn(),
    updateByIdAndUser: vi.fn(),
    deleteByIdAndUser: vi.fn(),
  }
  const accountOpsConfigRepository = {
    upsertByAccountId: vi.fn(),
    getByAccountId: vi.fn(),
    listByUser: vi.fn(),
  }
  const sensitiveWordService = {
    check: vi.fn(),
  }
  const channelAccountService = {
    getAccountInfo: vi.fn(),
    getUserAccountList: vi.fn(),
  }
  const service = new StrategyTemplateService(
    hookTemplateRepository as any,
    scriptTemplateRepository as any,
    accountOpsConfigRepository as any,
    sensitiveWordService as any,
    channelAccountService as any,
  )

  beforeEach(() => {
    vi.clearAllMocks()
    sensitiveWordService.check.mockReturnValue({ passed: true, hits: [] })
  })

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

  it('rejects account config updates for accounts not owned by the user', async () => {
    channelAccountService.getAccountInfo.mockResolvedValue({ id: 'account-1', userId: 'other-user' })

    await expect(service.upsertAccountConfig('user-1', 'account-1', {
      dailyPublishLimit: 10,
    } as any)).rejects.toMatchObject({ code: ResponseCode.ChannelAccountNotFound })
  })

  it('converts concurrent duplicate hook creates into validation errors', async () => {
    hookTemplateRepository.getByName.mockResolvedValue(null)
    hookTemplateRepository.create.mockRejectedValue({ code: 11000 })

    await expect(service.createHookTemplate('user-1', {
      name: '福利引导',
      category: HookTemplateCategory.BenefitGuide,
      content: '评论区告诉我你的尺码，我来给建议',
      weight: 1,
      enabled: true,
      applicablePlatforms: [],
      applicableCategories: [],
      applicableAccountIds: [],
    } as any)).rejects.toSatisfy((error: any) => {
      const response = error.getResponse()
      return error.code === ResponseCode.ValidationFailed
        && response.data.field === 'name'
        && response.data.reason === 'hook_template_name_exists'
    })
  })

  it('rejects public script contact info unless the scene is private-message WeChat guide', async () => {
    sensitiveWordService.check.mockReturnValue({ passed: false, hits: ['微信'] })

    await expect(service.createScriptTemplate('user-1', {
      name: '公开引导',
      scene: ScriptTemplateScene.CommentPraise,
      content: '加我微信 abc123',
      variables: [],
      enabled: true,
      applicableCategories: [],
      riskLevel: ScriptTemplateRiskLevel.High,
      platformConstraints: { allowWechatId: true, requireManualConfirm: true, blockedPlatforms: [] },
    } as any)).rejects.toSatisfy((error: any) => {
      const response = error.getResponse()
      return error.code === ResponseCode.ValidationFailed
        && response.data.field === 'content'
    })
  })

  it('lists account configs with null config for accounts without saved config', async () => {
    channelAccountService.getUserAccountList.mockResolvedValue([
      { id: 'account-1', type: 'xhs', nickname: 'Red', avatar: '', status: 'NORMAL' },
    ])
    accountOpsConfigRepository.listByUser.mockResolvedValue([])

    await expect(service.listAccountConfigs('user-1')).resolves.toEqual([
      {
        accountId: 'account-1',
        platform: 'xhs',
        nickname: 'Red',
        avatar: '',
        status: 'NORMAL',
        config: null,
      },
    ])
  })
})
