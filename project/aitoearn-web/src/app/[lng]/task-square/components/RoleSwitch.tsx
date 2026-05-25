'use client'

import Link from 'next/link'

export function RoleSwitch({ active }: { active: 'creator' | 'advertiser' }) {
  return (
    <div className="inline-flex rounded-md bg-sky-50 p-1 text-sm">
      <Link
        href="./?role=creator"
        className={`rounded-md px-3 py-2 ${active === 'creator' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'}`}
      >
        Creator
      </Link>
      <Link
        href="./?role=advertiser"
        className={`rounded-md px-3 py-2 ${active === 'advertiser' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'}`}
      >
        Advertiser
      </Link>
    </div>
  )
}
