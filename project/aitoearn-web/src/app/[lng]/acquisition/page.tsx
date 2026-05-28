import type { Metadata } from 'next'
import { useTranslation } from '@/app/i18n'
import { fallbackLng, languages } from '@/app/i18n/settings'
import { getMetadata } from '@/utils/general'
import { AcquisitionPageCore } from './acquisitionPageCore'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>
}): Promise<Metadata> {
  let { lng } = await params
  if (!languages.includes(lng))
    lng = fallbackLng
  const { t } = await useTranslation(lng, 'route')

  return getMetadata(
    {
      title: t('header.acquisition'),
      description: t('header.acquisition'),
      keywords: t('header.acquisition'),
    },
    lng,
  )
}

export default function AcquisitionPage() {
  return <AcquisitionPageCore />
}
