/**
 * 素材库页
 */

import type { Metadata } from 'next'
import { useTranslation } from '@/app/i18n'
import { fallbackLng, languages } from '@/app/i18n/settings'
import { getMetadata } from '@/utils/general'
import { AgentAssetsPageCore } from './agentAssetsPageCore'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>
}): Promise<Metadata> {
  let { lng } = await params
  if (!languages.includes(lng))
    lng = fallbackLng
  const { t } = await useTranslation(lng, 'material')

  return getMetadata(
    {
      title: t('agentAssets.libraryTitle'),
      description: t('agentAssets.description'),
      keywords: t('agentAssets.keywords'),
    },
    lng,
  )
}

export default function AgentAssetsPage() {
  return <AgentAssetsPageCore />
}
