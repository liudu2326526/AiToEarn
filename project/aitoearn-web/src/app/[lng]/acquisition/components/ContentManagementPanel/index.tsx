'use client'

import { useEffect } from 'react'
import { ContentGenerationForm } from '../ContentGenerationForm'
import { ContentReviewBoard } from '../ContentReviewBoard'
import { useContentGenerationStore } from '../../useContentGenerationStore'

export function ContentManagementPanel() {
  const fetchList = useContentGenerationStore(state => state.fetchList)

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  return (
    <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <ContentGenerationForm />
      <ContentReviewBoard />
    </section>
  )
}
