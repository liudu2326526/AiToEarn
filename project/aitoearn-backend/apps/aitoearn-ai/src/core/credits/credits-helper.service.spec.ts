import { NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { CreditsHelperService } from '../../../../../libs/helpers/src/credits/credits-helper.service'

vi.mock('@yikart/mongodb', () => ({
  UserRepository: class {},
}))

describe('creditsHelperService', () => {
  const createService = () => {
    const userRepository = {
      getCreditsBalanceById: vi.fn(),
      incrementCreditsById: vi.fn(),
      deductCreditsById: vi.fn(),
    }

    const service = new (CreditsHelperService as new (...args: unknown[]) => CreditsHelperService)(userRepository)
    return { service, userRepository }
  }

  it('reads the persisted credit balance for a user', async () => {
    const { service, userRepository } = createService()
    userRepository.getCreditsBalanceById.mockResolvedValue(125)

    await expect(service.getBalance('user-1')).resolves.toBe(125)

    expect(userRepository.getCreditsBalanceById).toHaveBeenCalledWith('user-1')
  })

  it('deducts credits atomically through the user repository', async () => {
    const { service, userRepository } = createService()
    userRepository.deductCreditsById.mockResolvedValue(80)

    await expect(service.deductCredits({
      userId: 'user-1',
      amount: 20,
      description: 'grok-imagine-video',
    })).resolves.toBeUndefined()

    expect(userRepository.deductCreditsById).toHaveBeenCalledWith('user-1', 20, expect.objectContaining({
      description: 'grok-imagine-video',
    }))
  })

  it('checks available credits before provider work starts', async () => {
    const { service, userRepository } = createService()
    userRepository.getCreditsBalanceById.mockResolvedValue(80)

    await expect(service.ensureEnoughCredits({
      userId: 'user-1',
      amount: 20,
    })).resolves.toBeUndefined()

    expect(userRepository.getCreditsBalanceById).toHaveBeenCalledWith('user-1')
  })

  it('rejects preflight when the user has insufficient credits', async () => {
    const { service, userRepository } = createService()
    userRepository.getCreditsBalanceById.mockResolvedValue(10)

    await expect(service.ensureEnoughCredits({
      userId: 'user-1',
      amount: 20,
    })).rejects.toMatchObject({
      message: '余额不足，请联系管理员充值',
    })
  })

  it('rejects deduction when the user has insufficient credits', async () => {
    const { service, userRepository } = createService()
    userRepository.deductCreditsById.mockResolvedValue(null)

    await expect(service.deductCredits({
      userId: 'user-1',
      amount: 20,
    })).rejects.toMatchObject({
      message: '余额不足，请联系管理员充值',
    })
  })

  it('adds credits and fails when the target user does not exist', async () => {
    const { service, userRepository } = createService()
    userRepository.incrementCreditsById.mockResolvedValueOnce(520)
    userRepository.incrementCreditsById.mockResolvedValueOnce(null)

    await expect(service.addCredits({ userId: 'user-1', amount: 20 })).resolves.toBeUndefined()
    await expect(service.addCredits({ userId: 'missing-user', amount: 20 })).rejects.toBeInstanceOf(NotFoundException)
  })
})
