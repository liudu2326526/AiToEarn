import type { PromotionLedgerItem } from '@/api/types/promotion'
import { create } from 'zustand'

interface GoldState {
  available: number
  pending: number
  ledger: PromotionLedgerItem[]
  setSummary: (summary: { available: number, pending: number }) => void
  setLedger: (ledger: PromotionLedgerItem[]) => void
}

export const useGoldStore = create<GoldState>(set => ({
  available: 0,
  pending: 0,
  ledger: [],
  setSummary: summary => set(summary),
  setLedger: ledger => set({ ledger }),
}))
