/**
 * BalanceEntry - 当前积分余额展示
 */

'use client'

import type { SidebarCommonProps } from '../../types'
import { Coins } from 'lucide-react'
import { useTransClient } from '@/app/i18n/client'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/store/user'

function getCreditsBalance(userInfo: ReturnType<typeof useUserStore.getState>['userInfo']) {
  return userInfo?.credits?.balance ?? userInfo?.creditsBalance ?? userInfo?.score ?? 0
}

function formatBalance(balance: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(balance)
}

export function BalanceEntry({ collapsed }: SidebarCommonProps) {
  const { t } = useTransClient('common')
  const token = useUserStore(state => state.token)
  const userInfo = useUserStore(state => state.userInfo)

  if (!token)
    return null

  const balance = formatBalance(Number(getCreditsBalance(userInfo)) || 0)
  const label = t('balance')

  const content = (
    <div
      data-testid="sidebar-current-balance"
      className={cn(
        'flex w-full items-center rounded-lg text-muted-foreground',
        collapsed ? 'h-9 w-9 justify-center' : 'justify-between px-3 py-2',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Coins size={18} className="shrink-0 text-amber-500" />
        {!collapsed && <span className="truncate text-sm">{label}</span>}
      </div>
      {!collapsed && (
        <span className="ml-2 truncate text-sm font-semibold text-foreground">
          {balance}
        </span>
      )}
    </div>
  )

  if (!collapsed)
    return content

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">
          <p>
            {label}
            :
            {' '}
            {balance}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
