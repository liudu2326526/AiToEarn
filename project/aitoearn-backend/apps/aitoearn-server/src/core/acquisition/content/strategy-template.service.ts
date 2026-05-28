import { Injectable } from '@nestjs/common'
import {
  AccountOpsConfigRepository,
  HookTemplateRepository,
  ScriptTemplateRepository,
  ScriptTemplateScene,
} from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { SensitiveWordService } from '../../sensitive-word/sensitive-word.service'

const PRIVATE_WECHAT_SCENES = new Set<string>([
  ScriptTemplateScene.PrivateMessageWechatGuide,
])

@Injectable()
export class StrategyTemplateService {
  constructor(
    private readonly hookTemplateRepository: HookTemplateRepository,
    private readonly scriptTemplateRepository: ScriptTemplateRepository,
    private readonly accountOpsConfigRepository: AccountOpsConfigRepository,
    private readonly sensitiveWordService: SensitiveWordService,
  ) {}

  async createHookTemplate(_userId: string, data: Parameters<HookTemplateRepository['create']>[0]) {
    const risk = this.sensitiveWordService.check(data.content || '')
    if (!risk.passed) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'public_hook_blocked_words', hits: risk.hits })
    }
    const duplicated = await this.hookTemplateRepository.getByName(String(data.name))
    if (duplicated) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'hook_template_name_exists' })
    }
    return await this.hookTemplateRepository.create(data)
  }

  async createScriptTemplate(_userId: string, data: Parameters<ScriptTemplateRepository['create']>[0]) {
    const content = String(data.content || '')
    const risk = this.sensitiveWordService.check(content)
    const allowWechatId = Boolean(data.platformConstraints?.allowWechatId)
    const isPrivateWechatScene = PRIVATE_WECHAT_SCENES.has(String(data.scene))
    if (!risk.passed && (!allowWechatId || !isPrivateWechatScene)) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'script_template_blocked_public_words', hits: risk.hits })
    }
    const duplicated = await this.scriptTemplateRepository.getByName(String(data.name))
    if (duplicated) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'script_template_name_exists' })
    }
    return await this.scriptTemplateRepository.create(data)
  }

  async upsertAccountConfig(accountId: string, data: Parameters<AccountOpsConfigRepository['upsertByAccountId']>[1]) {
    return await this.accountOpsConfigRepository.upsertByAccountId(accountId, data)
  }
}
