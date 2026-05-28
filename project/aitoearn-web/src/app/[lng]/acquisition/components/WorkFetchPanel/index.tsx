'use client'

import type { AcquisitionFetchResponse, AcquisitionPlatform } from '@/api/acquisition'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { fetchAcquisitionWork } from '@/api/acquisition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const platformOptions: Array<{ value: AcquisitionPlatform, label: string }> = [
  { value: 'xhs', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'kwai', label: '快手' },
]

export function WorkFetchPanel() {
  const [platform, setPlatform] = useState<AcquisitionPlatform>('xhs')
  const [accountId, setAccountId] = useState('')
  const [postUrl, setPostUrl] = useState('')
  const [postId, setPostId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AcquisitionFetchResponse>()
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetchAcquisitionWork({
        platform,
        accountId,
        postUrl,
        postId: postId || undefined,
      })
      setResult(response)
    }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : 'fetch failed')
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <form className="grid gap-3 md:grid-cols-[160px_1fr_1fr_auto]" onSubmit={submit}>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={platform}
          onChange={event => setPlatform(event.target.value as AcquisitionPlatform)}
        >
          {platformOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <Input value={accountId} onChange={event => setAccountId(event.target.value)} placeholder="accountId" required />
        <Input value={postUrl} onChange={event => setPostUrl(event.target.value)} placeholder="作品链接" required />
        <Input value={postId} onChange={event => setPostId(event.target.value)} placeholder="postId" />
        <div className="md:col-span-4">
          <Button type="submit" loading={loading} disabled={!accountId || !postUrl}>
            <Search size={16} />
            抓取
          </Button>
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {result && (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">状态</span>
              <p className="font-medium">{result.capabilityStatus}</p>
            </div>
            <div>
              <span className="text-muted-foreground">评论</span>
              <p className="font-medium">{result.commentsSaved}</p>
            </div>
            <div>
              <span className="text-muted-foreground">作品</span>
              <p className="font-medium">{result.postSaved ? 'saved' : 'not saved'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">分页</span>
              <p className="font-medium">{result.hasMore ? result.cursor || 'has more' : 'done'}</p>
            </div>
          </div>
          {result.capabilityReason && <p className="text-sm text-muted-foreground">{result.capabilityReason}</p>}
          {!!result.latestComments?.length && (
            <div className="grid gap-2">
              {result.latestComments.map(comment => (
                <div key={comment.commentId} className="rounded-md border border-border p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium">{comment.commentId}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{comment.dataSource}</span>
                  </div>
                  <p className="text-muted-foreground">{comment.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
