'use client'

import { Tag } from 'antd'
import type { ReactNode } from 'react'

interface StrategyStatusTagProps {
  color?: string
  enabled?: boolean
  children: ReactNode
}

export default function StrategyStatusTag({ color, enabled, children }: StrategyStatusTagProps) {
  const tagColor = color ?? (enabled ? 'success' : 'default')
  return (
    <Tag color={tagColor} style={{ marginInlineEnd: 0, borderRadius: 999 }}>
      {children}
    </Tag>
  )
}
