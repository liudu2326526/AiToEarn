import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { UserRepository } from '@yikart/mongodb'

export interface CreditsHelperOperation {
  userId: string
  amount: number
  type?: unknown
  source?: unknown
  description?: string
  metadata?: Record<string, unknown>
  expiredAt?: Date | null
}

@Injectable()
export class CreditsHelperService {
  constructor(
    private readonly userRepository: UserRepository,
  ) {}

  async getBalance(userId: string): Promise<number> {
    return await this.userRepository.getCreditsBalanceById(userId)
  }

  async addCredits(data: CreditsHelperOperation): Promise<void> {
    const amount = this.normalizeAmount(data.amount)
    const balance = await this.userRepository.incrementCreditsById(
      data.userId,
      amount,
      this.createOperationSnapshot(data, amount),
    )
    if (balance === null) {
      throw new NotFoundException('User not found')
    }
  }

  async deductCredits(data: CreditsHelperOperation): Promise<void> {
    const amount = this.normalizeAmount(data.amount)
    const balance = await this.userRepository.deductCreditsById(
      data.userId,
      amount,
      this.createOperationSnapshot(data, amount),
    )
    if (balance === null) {
      throw new BadRequestException('Insufficient credits')
    }
  }

  private normalizeAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Credit amount must be greater than 0')
    }
    return amount
  }

  private createOperationSnapshot(data: CreditsHelperOperation, amount: number): Record<string, unknown> {
    return {
      amount,
      type: data.type,
      source: data.source,
      description: data.description,
      metadata: data.metadata,
      expiredAt: data.expiredAt,
      operatedAt: new Date(),
    }
  }
}
