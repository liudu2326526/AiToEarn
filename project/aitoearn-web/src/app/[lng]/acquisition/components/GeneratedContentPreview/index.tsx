'use client'

import type { AcquisitionContent } from '@/api/types/acquisitionContent'

export function GeneratedContentPreview({ content }: { content: AcquisitionContent }) {
  return (
    <div className="grid gap-3">
      {content.platformContents.map(item => (
        <article key={item.platform} className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{item.platform}</span>
            <span className="text-muted-foreground">{item.topics.map(topic => `#${topic}`).join(' ')}</span>
          </div>
          <h3 className="text-base font-semibold">{item.title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>
        </article>
      ))}
    </div>
  )
}
