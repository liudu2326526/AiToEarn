import { describe, expect, it } from 'vitest'
import { calculatePricingPoints } from './pricing-calculator'

describe('calculatePricingPoints', () => {
  it('falls back to text tokens when modality details only contain provider-specific fields', () => {
    const points = calculatePricingPoints(
      {
        tiers: [
          {
            input: { text: '0.075' },
            output: { text: '0.45' },
          },
        ],
      },
      {
        input_tokens: 385,
        output_tokens: 86,
        input_token_details: { cache_read: 0 } as any,
        output_token_details: { reasoning: 65 } as any,
      },
    )

    expect(points).toBeGreaterThan(0)
    expect(points).toBeCloseTo(0.067575)
  })
})
