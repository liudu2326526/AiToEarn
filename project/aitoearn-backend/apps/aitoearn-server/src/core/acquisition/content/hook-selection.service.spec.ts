import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HookSelectionService } from './hook-selection.service'

describe('HookSelectionService', () => {
  const hookTemplateRepository = {
    listEnabledForSelection: vi.fn(),
  }
  const service = new HookSelectionService(
    hookTemplateRepository as any,
  )

  beforeEach(() => vi.clearAllMocks())

  it('returns the highest weighted matching hook deterministically', async () => {
    hookTemplateRepository.listEnabledForSelection.mockResolvedValue([
      { id: 'hook-low', content: '低权重', category: 'benefit_guide', weight: 1 },
      { id: 'hook-high', content: '想要同款的姐妹私信我', category: 'private_message_guide', weight: 10 },
    ])

    const result = await service.selectHook({ platform: 'xhs', accountId: 'acc-1', category: '裙子' })

    expect(result?.hookTemplateId).toBe('hook-high')
  })
})
