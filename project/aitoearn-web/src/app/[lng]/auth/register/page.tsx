import type { Metadata } from 'next'
import { useTranslation } from '@/app/i18n'
import { fallbackLng, languages } from '@/app/i18n/settings'
import { getMetadata } from '@/utils/general'
import RegisterContent from './components/RegisterContent'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>
}): Promise<Metadata> {
  let { lng } = await params
  if (!languages.includes(lng))
    lng = fallbackLng
  const { t } = await useTranslation(lng, 'login')

  return getMetadata(
    {
      title: t('register'),
      description: t('seo.loginDescription'),
      keywords: t('seo.loginKeywords'),
    },
    lng,
    '/auth/register',
  )
}

export default function RegisterPage() {
  return <RegisterContent />
}
