'use client'

import { useState } from 'react'
import { Button, Empty, Spin, Tag } from 'antd'
import { CalendarClock, Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { GeneratedContentPreview } from '../GeneratedContentPreview'
import { SchedulePublishDrawer } from '../SchedulePublishDrawer'
import { useContentGenerationStore } from '../../useContentGenerationStore'
import type { AcquisitionContent } from '@/api/types/acquisitionContent'

export function ContentReviewBoard() {
  const { t } = useTranslation('route')
  const [schedulingContent, setSchedulingContent] = useState<AcquisitionContent | undefined>()
  const { list, loading, review, fetchList } = useContentGenerationStore(useShallow(state => ({
    list: state.list,
    loading: state.loading,
    review: state.review,
    fetchList: state.fetchList,
  })))

  if (loading) return <Spin />
  if (!list.length) return <Empty />

  return (
    <div className="grid gap-3">
      {list.map(content => (
        <section key={content.id} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">{content.productName}</h2>
              <p className="text-sm text-muted-foreground">{content.productCategory}</p>
            </div>
            <Tag>{content.status}</Tag>
          </div>
          <GeneratedContentPreview content={content} />
          <div className="mt-3 flex justify-end gap-2">
            {content.status === 'pending_review' && (
              <>
                <Button icon={<X size={16} />} onClick={() => review(content.id, 'reject')}>{t('acquisition.actions.reject')}</Button>
                <Button type="primary" icon={<Check size={16} />} onClick={() => review(content.id, 'approve')}>{t('acquisition.actions.approve')}</Button>
              </>
            )}
            {content.status === 'approved' && (
              <Button type="primary" icon={<CalendarClock size={16} />} onClick={() => setSchedulingContent(content)}>
                {t('acquisition.actions.schedule')}
              </Button>
            )}
          </div>
        </section>
      ))}

      <SchedulePublishDrawer
        open={!!schedulingContent}
        content={schedulingContent}
        onClose={() => setSchedulingContent(undefined)}
        onScheduled={() => {
          setSchedulingContent(undefined)
          void fetchList()
        }}
      />
    </div>
  )
}
