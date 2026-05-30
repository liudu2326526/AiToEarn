import { Injectable } from '@nestjs/common'
import { AiService } from '@yikart/aitoearn-ai-client'
import { LeadActivityLogRepository, LeadRepository, ScriptTemplateRepository } from '@yikart/channel-db'
import { AppException, CreditsConsumptionSource, ResponseCode, UserType } from '@yikart/common'
import { SensitiveWordService } from '../../sensitive-word/sensitive-word.service'

@Injectable()
export class ReplySuggestionService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
    private readonly aiService: AiService,
    private readonly sensitiveWordService: SensitiveWordService,
    private readonly scriptTemplateRepository: ScriptTemplateRepository,
  ) {}

  async generate(userId: string, id: string, operatorId: string) {
    const lead = await this.leadRepository.getByIdAndUser(id, userId)
    if (!lead) throw new AppException(ResponseCode.LeadNotFound)

    const scripts = await this.scriptTemplateRepository.listByScene(
      userId,
      'comment_praise',
      '',
    )
    const scriptInstruction = scripts[0]?.content
      ? `优先参考这条话术模板，但不要照抄: ${scripts[0].content}`
      : '没有可用话术模板时，生成一条自然、简短、无联系方式的公开评论回复。'

    const aiResult = await this.aiService.chatCompletion({
      userId,
      userType: UserType.User,
      model: 'gpt-5.5',
      source: CreditsConsumptionSource.Plugin,
      messages: [
        { role: 'system', content: '你是电商运营客服，只输出一条适合公开评论区的简短中文回复。禁止出现微信、手机号、网址、二维码或引导加私域。' },
        { role: 'user', content: `平台: ${lead.platform}\n用户评论: ${lead.sourceContent || ''}\n${scriptInstruction}` },
      ],
    } as any)

    const reply = String(aiResult?.content || '').trim() || '感谢你的反馈，我们会尽快确认后回复你。'
    const modelName = String(aiResult?.model || 'gpt-5.5')
    const safety = this.sensitiveWordService.check(reply)
    const riskHits = safety.hits || []
    const blocked = riskHits.length > 0 || /微信|VX|V信|手机号|电话|http|www\./i.test(reply)
    const updated = await this.leadRepository.updateById(lead.id, {
      suggestedReply: {
        content: reply,
        model: modelName,
        status: blocked ? 'blocked' : 'generated',
        riskHits,
        generatedAt: new Date(),
      },
    } as any)

    await this.leadActivityLogRepository.append({
      userId,
      leadId: lead.id,
      action: 'reply_suggested',
      operatorId,
      note: blocked ? `blocked: ${riskHits.join(',')}` : reply,
    })

    return updated
  }
}
