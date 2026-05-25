'use client'

import type { PromotionLedgerItem } from '@/api/types/promotion'
import { CircleDollarSign, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiGetPromotionGoldSummary, apiListPromotionLedger } from '@/api/promotion'

export default function GoldPage() {
  const [available, setAvailable] = useState(0)
  const [pending, setPending] = useState(0)
  const [ledger, setLedger] = useState<PromotionLedgerItem[]>([])

  useEffect(() => {
    apiGetPromotionGoldSummary().then((res) => {
      setAvailable(res?.data?.available ?? 0)
      setPending(res?.data?.pending ?? 0)
    })
    apiListPromotionLedger({ page: 1, pageSize: 20 }).then((res) => {
      setLedger(res?.data?.list ?? [])
    })
  }, [])

  return (
    <div className="min-h-full bg-[#f6fbff] px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">金币中心</h1>
          <p className="mt-1 text-sm text-slate-600">查看推广任务收益和结算流水。</p>
        </header>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
            <CircleDollarSign className="h-6 w-6 text-sky-500" />
            <p className="mt-4 text-sm text-slate-500">可用收益</p>
            <p className="mt-1 text-3xl font-semibold text-slate-950">¥{available}</p>
          </section>
          <section className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
            <Clock className="h-6 w-6 text-sky-500" />
            <p className="mt-4 text-sm text-slate-500">待结算</p>
            <p className="mt-1 text-3xl font-semibold text-slate-950">¥{pending}</p>
          </section>
        </div>

        <section className="mt-5 rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">流水记录</h2>
          {ledger.length === 0
            ? <div className="py-14 text-center text-sm text-slate-500">暂无流水</div>
            : (
                <div className="mt-4 divide-y divide-slate-100">
                  {ledger.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{item.type}</p>
                        <p className="mt-1 text-slate-500">{item.status}</p>
                      </div>
                      <span className={item.direction === 'credit' ? 'text-emerald-600' : 'text-red-600'}>
                        {item.direction === 'credit' ? '+' : '-'}
                        ¥{item.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
        </section>
      </div>
    </div>
  )
}
