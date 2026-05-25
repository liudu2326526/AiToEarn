'use client'

import type { PromotionSettlementType } from '@/api/types/promotion'
import { Filter } from 'lucide-react'

const options: Array<{ value: PromotionSettlementType | '', label: string }> = [
  { value: '', label: '全部' },
  { value: 'fixed', label: '固定' },
  { value: 'cpm', label: 'CPM' },
  { value: 'cpe', label: 'CPE' },
  { value: 'interaction', label: '互动' },
]

export function TaskFilters({
  value,
  onChange,
}: {
  value: PromotionSettlementType | ''
  onChange: (value: PromotionSettlementType | '') => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => (
        <button
          key={option.value || 'all'}
          type="button"
          className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm ${
            value === option.value
              ? 'border-sky-300 bg-sky-50 text-sky-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200'
          }`}
          onClick={() => onChange(option.value)}
        >
          <Filter className="h-4 w-4" />
          {option.label}
        </button>
      ))}
    </div>
  )
}
