import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  AccountOpsConfigRepository,
  HookTemplateRepository,
  ScriptTemplateRepository,
  ScriptTemplateScene,
} from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { Account } from '@yikart/mongodb'
import { ChannelAccountService } from '../../channel/platforms/channel-account.service'
import { SensitiveWordService } from '../../sensitive-word/sensitive-word.service'
import {
  CreateHookTemplateDto,
  CreateScriptTemplateDto,
  ListHookTemplateDto,
  ListScriptTemplateDto,
  UpdateHookTemplateDto,
  UpdateScriptTemplateDto,
  UpsertAccountOpsConfigDto,
} from './acquisition-content.dto'

const PRIVATE_WECHAT_SCENES = new Set<string>([
  ScriptTemplateScene.PrivateMessageWechatGuide,
])

@Injectable()
export class StrategyTemplateService {
  private readonly logger = new Logger(StrategyTemplateService.name)

  constructor(
    private readonly hookTemplateRepository: HookTemplateRepository,
    private readonly scriptTemplateRepository: ScriptTemplateRepository,
    private readonly accountOpsConfigRepository: AccountOpsConfigRepository,
    private readonly sensitiveWordService: SensitiveWordService,
    private readonly channelAccountService: ChannelAccountService,
  ) {}

  async onModuleInit() {
    try {
      const dropped = await this.accountOpsConfigRepository.dropLegacyAccountIdUniqueIndex()
      if (dropped) {
        this.logger.warn('Dropped legacy unique index account_ops_config.accountId_1')
      }
    }
    catch (error) {
      this.logger.error(error, 'Failed to drop legacy account_ops_config.accountId_1 index')
    }
  }

  async listHookTemplates(userId: string, query: ListHookTemplateDto) {
    return await this.hookTemplateRepository.listByUser(userId, query)
  }

  async createHookTemplate(userId: string, data: CreateHookTemplateDto) {
    const risk = this.sensitiveWordService.check(data.content || '')
    if (!risk.passed) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'public_hook_blocked_words', hits: risk.hits })
    }
    const duplicated = await this.hookTemplateRepository.getByName(userId, String(data.name))
    if (duplicated) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'hook_template_name_exists' })
    }
    try {
      return await this.hookTemplateRepository.create({ ...data, userId })
    }
    catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'hook_template_name_exists' })
      }
      throw error
    }
  }

  async updateHookTemplate(userId: string, id: string, data: UpdateHookTemplateDto) {
    if (data.content) {
      const risk = this.sensitiveWordService.check(data.content)
      if (!risk.passed) {
        throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'public_hook_blocked_words', hits: risk.hits })
      }
    }
    if (data.name) {
      const duplicated = await this.hookTemplateRepository.getByName(userId, data.name)
      if (duplicated && String(duplicated.id) !== id) {
        throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'hook_template_name_exists' })
      }
    }
    const updated = await this.hookTemplateRepository.updateByIdAndUser(id, userId, data as any)
    if (!updated) throw new AppException(ResponseCode.StrategyTemplateNotFound)
    return updated
  }

  async deleteHookTemplate(userId: string, id: string) {
    const existing = await this.hookTemplateRepository.getByIdAndUser(id, userId)
    if (!existing) throw new AppException(ResponseCode.StrategyTemplateNotFound)
    await this.hookTemplateRepository.deleteByIdAndUser(id, userId)
    return { deleted: true }
  }

  async listScriptTemplates(userId: string, query: ListScriptTemplateDto) {
    return await this.scriptTemplateRepository.listByUser(userId, query)
  }

  async createScriptTemplate(userId: string, data: CreateScriptTemplateDto) {
    this.assertScriptTemplateSafety(data)
    const duplicated = await this.scriptTemplateRepository.getByName(userId, String(data.name))
    if (duplicated) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'script_template_name_exists' })
    }
    try {
      return await this.scriptTemplateRepository.create({ ...data, userId })
    }
    catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'script_template_name_exists' })
      }
      throw error
    }
  }

  async updateScriptTemplate(userId: string, id: string, data: UpdateScriptTemplateDto) {
    const existing = await this.scriptTemplateRepository.getByIdAndUser(id, userId)
    if (!existing) throw new AppException(ResponseCode.StrategyTemplateNotFound)
    this.assertScriptTemplateSafety({ ...existing, ...data })
    if (data.name) {
      const duplicated = await this.scriptTemplateRepository.getByName(userId, data.name)
      if (duplicated && String(duplicated.id) !== id) {
        throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'script_template_name_exists' })
      }
    }
    const updated = await this.scriptTemplateRepository.updateByIdAndUser(id, userId, data as any)
    if (!updated) throw new AppException(ResponseCode.StrategyTemplateNotFound)
    return updated
  }

  async deleteScriptTemplate(userId: string, id: string) {
    const existing = await this.scriptTemplateRepository.getByIdAndUser(id, userId)
    if (!existing) throw new AppException(ResponseCode.StrategyTemplateNotFound)
    await this.scriptTemplateRepository.deleteByIdAndUser(id, userId)
    return { deleted: true }
  }

  async getAccountConfig(userId: string, accountId: string) {
    await this.assertAccountOwner(userId, accountId)
    return await this.accountOpsConfigRepository.getByAccountId(userId, accountId)
  }

  async upsertAccountConfig(userId: string, accountId: string, data: UpsertAccountOpsConfigDto) {
    await this.assertAccountOwner(userId, accountId)
    return await this.accountOpsConfigRepository.upsertByAccountId(userId, accountId, data)
  }

  async listAccountConfigs(userId: string) {
    const [accounts, configs] = await Promise.all([
      this.channelAccountService.getUserAccountList(userId),
      this.accountOpsConfigRepository.listByUser(userId),
    ])
    const configByAccountId = new Map(configs.map(config => [String(config.accountId), config]))
    return accounts.map(account => ({
      accountId: account.id,
      platform: account.type,
      nickname: account.nickname,
      avatar: account.avatar || '',
      status: account.status,
      config: configByAccountId.get(String(account.id)) || null,
    }))
  }

  private async assertAccountOwner(userId: string, accountId: string): Promise<Account> {
    const account = await this.channelAccountService.getAccountInfo(accountId)
    if (!account || account.userId !== userId) {
      throw new AppException(ResponseCode.ChannelAccountNotFound)
    }
    return account
  }

  private assertScriptTemplateSafety(data: Pick<CreateScriptTemplateDto, 'content' | 'scene' | 'platformConstraints'>) {
    const content = String(data.content || '')
    const risk = this.sensitiveWordService.check(content)
    const allowWechatId = Boolean(data.platformConstraints?.allowWechatId)
    const isPrivateWechatScene = PRIVATE_WECHAT_SCENES.has(String(data.scene))
    const exempted = allowWechatId && isPrivateWechatScene
    if (!risk.passed && !exempted) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'script_template_blocked_public_words', hits: risk.hits })
    }
  }

  private isDuplicateKeyError(error: unknown) {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code?: number }).code === 11000
  }
}
