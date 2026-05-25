import { CreditsType } from '@yikart/common'
import { describe, expect, it, vi } from 'vitest'
import { NewUser, REGISTER_BONUS_CREDITS, UserCreateType } from './user.class'

vi.mock('@yikart/mongodb', () => ({
  User: class {},
}))

describe('NewUser', () => {
  it('initializes new users with registration bonus credits', () => {
    const user = new NewUser(UserCreateType.mail, 'new@example.com')

    expect(user.creditsBalance).toBe(REGISTER_BONUS_CREDITS)
    expect(user.credits).toMatchObject({
      balance: REGISTER_BONUS_CREDITS,
      total: REGISTER_BONUS_CREDITS,
      unit: 'credits',
      lastOperation: {
        amount: REGISTER_BONUS_CREDITS,
        type: CreditsType.RegisterBonus,
        description: 'Registration bonus credits',
      },
    })
    expect(user.credits?.updatedAt).toBeInstanceOf(Date)
  })
})
