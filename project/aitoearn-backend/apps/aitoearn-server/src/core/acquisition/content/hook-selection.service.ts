import { Injectable } from '@nestjs/common'
import { HookTemplateRepository } from '@yikart/channel-db'

@Injectable()
export class HookSelectionService {
  constructor(private readonly hookTemplateRepository: HookTemplateRepository) {}

  async selectHook(query: { userId: string, platform: string, accountId?: string, category?: string }) {
    const hooks = await this.hookTemplateRepository.listEnabledForSelection(query)
    const sorted = [...hooks].sort((a, b) => {
      const weightDiff = (b.weight || 0) - (a.weight || 0)
      if (weightDiff !== 0) return weightDiff
      return String(a.id).localeCompare(String(b.id))
    })
    const selected = sorted[0]
    if (!selected) return null
    return {
      hookTemplateId: selected.id,
      content: selected.content,
      category: selected.category,
    }
  }
}
