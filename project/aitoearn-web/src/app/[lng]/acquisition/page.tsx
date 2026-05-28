import { redirect } from 'next/navigation'

export default async function AcquisitionPage({
  params,
}: {
  params: Promise<{ lng: string }>
}) {
  const { lng } = await params
  redirect(`/${lng}/acquisition-dashboard`)
}
