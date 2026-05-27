/**
 * Asset library page.
 * Keeps Agent generated assets and adds local uploads plus Seedance portrait staging.
 */

'use client'

import type { MediaPreviewItem } from '@/components/common/MediaPreview'
import type React from 'react'
import type { PortraitAssetVo } from '@/api/ai'
import type { AssetVo } from '@/types/agent-asset'
import { Bot, CheckCircle2, Copy, ImagePlus, Loader2, RefreshCw, Upload, UserRound, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import Masonry from 'react-masonry-css'
import { toast } from 'sonner'
import { createPortraitAsset, getAgentAssets, getPortraitAssets, refreshPortraitAsset } from '@/api/ai'
import { uploadToOss, uploadToOssAsset } from '@/api/oss'
import { useTransClient } from '@/app/i18n/client'
import { MediaPreview } from '@/components/common/MediaPreview'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks'
import { getAssetMediaType } from '@/utils/agent-asset'
import { getOssUrl } from '@/utils/oss'
import { AgentAssetCard } from './components/AgentAssetCard'
import { AgentAssetCardSkeleton } from './components/AgentAssetCard/AgentAssetCardSkeleton'
import { AgentAssetsHeader } from './components/AgentAssetsHeader'

const PAGE_SIZE = 20

const MASONRY_BREAKPOINTS = {
  default: 5,
  1280: 4,
  1024: 3,
  768: 3,
  640: 2,
}

type LibraryTab = 'agent' | 'local' | 'portrait'

function getPreviewItems(assets: AssetVo[]): MediaPreviewItem[] {
  return assets.map((asset) => {
    const mediaType = getAssetMediaType(asset)
    return {
      type: mediaType === 'video' ? 'video' : 'image',
      src: getOssUrl(asset.url),
      title: asset.filename,
    }
  })
}

function portraitToAssetVo(asset: PortraitAssetVo): AssetVo {
  return {
    id: asset.id,
    url: asset.sourceUrl,
    path: asset.sourceUrl,
    type: 'userMedia',
    mimeType: asset.mimeType || 'image/*',
    filename: asset.filename,
    size: asset.size,
    status: asset.status === 'active' ? 'confirmed' : asset.status,
    createdAt: asset.createdAt || '',
    updatedAt: asset.updatedAt || '',
  }
}

function readImageDimensions(file: File): Promise<{ width: number, height: number } | undefined> {
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(undefined)
  }

  return new Promise((resolve) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(undefined)
    }
    image.src = objectUrl
  })
}

export function AgentAssetsPageCore() {
  const { t } = useTransClient('material')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const localUploadInputRef = useRef<HTMLInputElement>(null)
  const portraitUploadInputRef = useRef<HTMLInputElement>(null)

  useDocumentTitle(t('agentAssets.libraryTitle'))

  const [activeTab, setActiveTab] = useState<LibraryTab>('agent')
  const [agentAssets, setAgentAssets] = useState<AssetVo[]>([])
  const [localAssets, setLocalAssets] = useState<AssetVo[]>([])
  const [portraitAssets, setPortraitAssets] = useState<PortraitAssetVo[]>([])
  const [total, setTotal] = useState({ agent: 0, local: 0, portrait: 0 })
  const [page, setPage] = useState({ agent: 1, local: 1 })
  const [hasMore, setHasMore] = useState({ agent: true, local: true })
  const [loadingTab, setLoadingTab] = useState<LibraryTab | null>('agent')
  const [loadingMoreTab, setLoadingMoreTab] = useState<LibraryTab | null>(null)
  const [isUploadingLocal, setIsUploadingLocal] = useState(false)
  const [isUploadingPortrait, setIsUploadingPortrait] = useState(false)
  const [portraitUploadStatus, setPortraitUploadStatus] = useState('')
  const [registeringLocalIds, setRegisteringLocalIds] = useState<Set<string>>(() => new Set())
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  const activeAssets = activeTab === 'agent'
    ? agentAssets
    : activeTab === 'local'
      ? localAssets
      : portraitAssets.map(portraitToAssetVo)

  const totalForActiveTab = total[activeTab]
  const registeredPortraitSourceIds = useMemo(() => {
    return new Set(portraitAssets.map(asset => asset.sourceAssetId).filter(Boolean) as string[])
  }, [portraitAssets])

  const loadAssets = useCallback(async (tab: Extract<LibraryTab, 'agent' | 'local'>, nextPage = 1, append = false) => {
    if (append)
      setLoadingMoreTab(tab)
    else
      setLoadingTab(tab)

    try {
      const result = await getAgentAssets({
        page: nextPage,
        pageSize: PAGE_SIZE,
        source: tab === 'local' ? 'userMedia' : 'agent',
      })
      const list = result?.data?.list || []
      const totalCount = result?.data?.total || 0

      if (tab === 'agent') {
        setAgentAssets(prev => append ? [...prev, ...list] : list)
      }
      else {
        setLocalAssets(prev => append ? [...prev, ...list] : list)
      }

      setTotal(prev => ({ ...prev, [tab]: totalCount }))
      setPage(prev => ({ ...prev, [tab]: nextPage }))
      setHasMore(prev => ({
        ...prev,
        [tab]: (append ? (tab === 'agent' ? agentAssets.length : localAssets.length) : 0) + list.length < totalCount,
      }))
    }
    catch (error) {
      console.error(`Failed to fetch ${tab} assets:`, error)
    }
    finally {
      setLoadingTab(current => current === tab ? null : current)
      setLoadingMoreTab(current => current === tab ? null : current)
    }
  }, [agentAssets.length, localAssets.length])

  const loadPortraitAssets = useCallback(async () => {
    setLoadingTab('portrait')
    try {
      const result = await getPortraitAssets({
        page: 1,
        pageSize: PAGE_SIZE,
      })
      const list = result?.data?.list || []
      setPortraitAssets(list)
      setTotal(prev => ({ ...prev, portrait: result?.data?.total || 0 }))
    }
    catch (error) {
      console.error('Failed to fetch portrait assets:', error)
    }
    finally {
      setLoadingTab(current => current === 'portrait' ? null : current)
    }
  }, [])

  useEffect(() => {
    loadAssets('agent')
    loadAssets('local')
    loadPortraitAssets()
  }, [loadAssets, loadPortraitAssets])

  const handleLoadMore = useCallback(() => {
    if (activeTab === 'portrait' || loadingMoreTab === activeTab || !hasMore[activeTab])
      return
    loadAssets(activeTab, page[activeTab] + 1, true)
  }, [activeTab, hasMore, loadAssets, loadingMoreTab, page])

  const handleAssetClick = useCallback((asset: AssetVo) => {
    const index = activeAssets.findIndex(item => item.id === asset.id)
    if (index !== -1) {
      setPreviewIndex(index)
      setPreviewOpen(true)
    }
  }, [activeAssets])

  const handleLocalUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length)
      return

    setIsUploadingLocal(true)
    try {
      await Promise.all(Array.from(files).map(file => uploadToOss(file)))
      toast.success(t('agentAssets.assetUploaded'))
      await loadAssets('local')
    }
    catch (error) {
      console.error('Failed to upload local assets:', error)
      toast.error(t('agentAssets.uploadFailed'))
    }
    finally {
      setIsUploadingLocal(false)
      if (localUploadInputRef.current)
        localUploadInputRef.current.value = ''
    }
  }, [loadAssets, t])

  const registerPortraitAsset = useCallback(async (params: {
    url: string
    sourceAssetId?: string
    filename?: string
    mimeType?: string
    size?: number
    width?: number
    height?: number
  }) => {
    const response = await createPortraitAsset(params)
    if (response?.code !== 0 || !response?.data?.id || !response.data.status) {
      throw new Error(response?.message || t('agentAssets.registerPortraitFailed'))
    }
    return response.data
  }, [t])

  const handlePortraitUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length)
      return

    setIsUploadingPortrait(true)
    setPortraitUploadStatus(t('agentAssets.uploadingPortrait'))
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const uploadedAsset = await uploadToOssAsset(file)
          setPortraitUploadStatus(t('agentAssets.registeringPortrait'))
          const dimensions = await readImageDimensions(file)
          return registerPortraitAsset({
            url: uploadedAsset.url,
            sourceAssetId: uploadedAsset.id,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            width: dimensions?.width,
            height: dimensions?.height,
          })
        }),
      )
      const nextAssets = uploaded.filter(Boolean) as PortraitAssetVo[]
      setPortraitAssets(prev => [...nextAssets, ...prev])
      setTotal(prev => ({ ...prev, portrait: prev.portrait + nextAssets.length }))
      setPortraitUploadStatus(t('agentAssets.portraitSubmitted'))
      toast.success(t('agentAssets.portraitSubmitted'))
    }
    catch (error) {
      console.error('Failed to upload portrait assets:', error)
      setPortraitUploadStatus('')
      toast.error(error instanceof Error ? error.message : t('agentAssets.uploadFailed'))
    }
    finally {
      setIsUploadingPortrait(false)
      if (portraitUploadInputRef.current)
        portraitUploadInputRef.current.value = ''
    }
  }, [registerPortraitAsset, t])

  const handleRegisterLocalPortrait = useCallback(async (asset: AssetVo) => {
    if (getAssetMediaType(asset) !== 'img') {
      toast.error(t('agentAssets.onlyImagePortrait'))
      return
    }

    setRegisteringLocalIds(prev => new Set(prev).add(asset.id))
    try {
      const created = await registerPortraitAsset({
        url: getOssUrl(asset.url),
        sourceAssetId: asset.id,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
        width: typeof asset.metadata?.width === 'number' ? asset.metadata.width : undefined,
        height: typeof asset.metadata?.height === 'number' ? asset.metadata.height : undefined,
      })
      setPortraitAssets(prev => [created, ...prev])
      setTotal(prev => ({ ...prev, portrait: prev.portrait + 1 }))
      toast.success(t('agentAssets.portraitSubmitted'))
    }
    catch (error) {
      console.error('Failed to register local portrait asset:', error)
      toast.error(error instanceof Error ? error.message : t('agentAssets.registerPortraitFailed'))
    }
    finally {
      setRegisteringLocalIds((prev) => {
        const next = new Set(prev)
        next.delete(asset.id)
        return next
      })
    }
  }, [registerPortraitAsset, t])

  const handleRefreshPortrait = useCallback(async (asset: PortraitAssetVo) => {
    try {
      const response = await refreshPortraitAsset(asset.id)
      if (response?.data) {
        setPortraitAssets(prev => prev.map(item => item.id === asset.id ? response.data : item))
      }
    }
    catch (error) {
      console.error('Failed to refresh portrait asset:', error)
    }
  }, [])

  const handleCopyAssetUri = useCallback(async (assetUri?: string) => {
    if (!assetUri)
      return
    await navigator.clipboard.writeText(assetUri)
    toast.success(t('agentAssets.assetUriCopied'))
  }, [t])

  const previewItems = useMemo(() => getPreviewItems(activeAssets), [activeAssets])

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <AgentAssetsHeader total={totalForActiveTab} />

      <main
        id="agent-assets-scroll-container"
        ref={scrollContainerRef}
        className="flex-1 px-4 py-6 overflow-y-auto"
      >
        <div className="w-full mx-auto space-y-4">
          <div className="rounded-lg border border-sky-100 bg-card p-4 shadow-sm">
            <Tabs value={activeTab} onValueChange={value => setActiveTab(value as LibraryTab)}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <TabsList className="bg-sky-50 text-slate-500">
                  <TabsTrigger value="agent">{t('agentAssets.agentTab')}</TabsTrigger>
                  <TabsTrigger value="local">{t('agentAssets.localTab')}</TabsTrigger>
                  <TabsTrigger value="portrait">{t('agentAssets.portraitTab')}</TabsTrigger>
                </TabsList>

                <div className="flex flex-wrap items-center gap-2">
                  {activeTab === 'local' && (
                    <>
                      <Button
                        type="button"
                        onClick={() => localUploadInputRef.current?.click()}
                        disabled={isUploadingLocal}
                      >
                        {isUploadingLocal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {t('agentAssets.uploadLocal')}
                      </Button>
                      <input
                        ref={localUploadInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={event => handleLocalUpload(event.target.files)}
                      />
                    </>
                  )}

                  {activeTab === 'portrait' && (
                    <>
                      <Button
                        type="button"
                        onClick={() => portraitUploadInputRef.current?.click()}
                        disabled={isUploadingPortrait}
                      >
                        {isUploadingPortrait ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRound className="mr-2 h-4 w-4" />}
                        {t('agentAssets.uploadPortrait')}
                      </Button>
                      <input
                        ref={portraitUploadInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={event => handlePortraitUpload(event.target.files)}
                      />
                    </>
                  )}
                </div>
              </div>

              <TabsContent value="agent" className="mt-4">
                <LibrarySection
                  assets={agentAssets}
                  total={total.agent}
                  loading={loadingTab === 'agent'}
                  hasMore={hasMore.agent}
                  emptyIcon={<Bot className="w-10 h-10 text-muted-foreground" />}
                  emptyTitle={t('agentAssets.noAssets')}
                  emptyDescription={t('agentAssets.noAssetsDesc')}
                  emptyAction={<Button asChild><Link href="/chat">{t('agentAssets.goToChat')}</Link></Button>}
                  onAssetClick={handleAssetClick}
                  onLoadMore={handleLoadMore}
                />
              </TabsContent>

              <TabsContent value="local" className="mt-4">
                <LibrarySection
                  assets={localAssets}
                  total={total.local}
                  loading={loadingTab === 'local'}
                  hasMore={hasMore.local}
                  emptyIcon={<ImagePlus className="w-10 h-10 text-muted-foreground" />}
                  emptyTitle={t('agentAssets.noLocalAssets')}
                  emptyDescription={t('agentAssets.noLocalAssetsDesc')}
                  emptyAction={(
                    <Button onClick={() => localUploadInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" />
                      {t('agentAssets.uploadLocal')}
                    </Button>
                  )}
                  onAssetClick={handleAssetClick}
                  onLoadMore={handleLoadMore}
                  renderAssetAction={(asset) => {
                    const isImage = getAssetMediaType(asset) === 'img'
                    const isRegistering = registeringLocalIds.has(asset.id)
                    const isRegistered = registeredPortraitSourceIds.has(asset.id)
                    return (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        disabled={!isImage || isRegistering || isRegistered}
                        onClick={() => handleRegisterLocalPortrait(asset)}
                      >
                        {isRegistering ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <UserRound className="mr-2 h-3.5 w-3.5" />}
                        {isRegistered
                          ? t('agentAssets.registeredToPortrait')
                          : isRegistering
                            ? t('agentAssets.registeringPortraitShort')
                            : t('agentAssets.registerToPortrait')}
                      </Button>
                    )
                  }}
                />
              </TabsContent>

              <TabsContent value="portrait" className="mt-4">
                {portraitUploadStatus && (
                  <div className="mb-4 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                    {portraitUploadStatus}
                  </div>
                )}
                <PortraitLibrarySection
                  assets={portraitAssets}
                  total={total.portrait}
                  loading={loadingTab === 'portrait'}
                  emptyIcon={<UserRound className="w-10 h-10 text-muted-foreground" />}
                  emptyTitle={t('agentAssets.noPortraitAssets')}
                  emptyDescription={t('agentAssets.noPortraitAssetsDesc')}
                  emptyAction={(
                    <Button onClick={() => portraitUploadInputRef.current?.click()}>
                      <UserRound className="mr-2 h-4 w-4" />
                      {t('agentAssets.uploadPortrait')}
                    </Button>
                  )}
                  onAssetClick={asset => handleAssetClick(portraitToAssetVo(asset))}
                  onCopyAssetUri={handleCopyAssetUri}
                  onRefresh={handleRefreshPortrait}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <MediaPreview
        open={previewOpen}
        items={previewItems}
        initialIndex={previewIndex}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  )
}

function LibrarySection({
  assets,
  total,
  loading,
  hasMore,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onAssetClick,
  onLoadMore,
  renderAssetAction,
}: {
  assets: AssetVo[]
  total: number
  loading: boolean
  hasMore: boolean
  emptyIcon: React.ReactNode
  emptyTitle: string
  emptyDescription: string
  emptyAction: React.ReactNode
  onAssetClick: (asset: AssetVo) => void
  onLoadMore: () => void
  renderAssetAction?: (asset: AssetVo) => React.ReactNode
}) {
  const { t } = useTransClient('material')

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: PAGE_SIZE }).map((_, index) => (
          <AgentAssetCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          {emptyIcon}
        </div>
        <h3 className="mb-2 text-lg font-medium text-foreground">{emptyTitle}</h3>
        <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">{emptyDescription}</p>
        {emptyAction}
      </div>
    )
  }

  return (
    <InfiniteScroll
      dataLength={assets.length}
      next={onLoadMore}
      hasMore={hasMore}
      scrollThreshold={0.8}
      loader={(
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      endMessage={(
        <div className="flex justify-center py-8 text-sm text-muted-foreground">
          {t('mediaManagement.loadedAll')}
          {' · '}
          {total}
          {' '}
          {t('mediaManagement.resources')}
        </div>
      )}
      scrollableTarget="agent-assets-scroll-container"
    >
      <Masonry
        breakpointCols={MASONRY_BREAKPOINTS}
        className="flex w-auto -ml-4"
        columnClassName="pl-4 bg-clip-padding"
      >
        {assets.map(asset => (
          <div key={asset.id} className="mb-4">
            <AgentAssetCard asset={asset} onClick={onAssetClick} />
            {renderAssetAction?.(asset)}
          </div>
        ))}
      </Masonry>
    </InfiniteScroll>
  )
}

function PortraitLibrarySection({
  assets,
  total,
  loading,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onAssetClick,
  onCopyAssetUri,
  onRefresh,
}: {
  assets: PortraitAssetVo[]
  total: number
  loading: boolean
  emptyIcon: React.ReactNode
  emptyTitle: string
  emptyDescription: string
  emptyAction: React.ReactNode
  onAssetClick: (asset: PortraitAssetVo) => void
  onCopyAssetUri: (assetUri?: string) => void
  onRefresh: (asset: PortraitAssetVo) => void
}) {
  const { t } = useTransClient('material')

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: PAGE_SIZE }).map((_, index) => (
          <AgentAssetCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          {emptyIcon}
        </div>
        <h3 className="mb-2 text-lg font-medium text-foreground">{emptyTitle}</h3>
        <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">{emptyDescription}</p>
        {emptyAction}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Masonry
        breakpointCols={MASONRY_BREAKPOINTS}
        className="flex w-auto -ml-4"
        columnClassName="pl-4 bg-clip-padding"
      >
        {assets.map(asset => (
          <div key={asset.id} className="mb-4 overflow-hidden rounded-lg border border-sky-100 bg-background shadow-sm">
            <button
              type="button"
              className="block w-full bg-muted"
              onClick={() => onAssetClick(asset)}
            >
              <img
                src={getOssUrl(asset.sourceUrl)}
                alt={asset.filename || t('agentAssets.portraitTab')}
                className="h-auto w-full object-cover"
              />
            </button>
            <div className="space-y-3 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{asset.filename || t('agentAssets.portraitTab')}</p>
                  {asset.width && asset.height && (
                    <p className="text-xs text-muted-foreground">
                      {asset.width}
                      {' x '}
                      {asset.height}
                    </p>
                  )}
                </div>
                <PortraitStatusBadge status={asset.status} />
              </div>

              {asset.assetUri && (
                <button
                  type="button"
                  className="w-full truncate rounded bg-sky-50 px-2 py-1 text-left text-xs text-sky-700"
                  onClick={() => onCopyAssetUri(asset.assetUri)}
                  title={asset.assetUri}
                >
                  {asset.assetUri}
                </button>
              )}

              {asset.failureReason && (
                <p className="line-clamp-2 text-xs text-destructive">{asset.failureReason}</p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onRefresh(asset)}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  {t('agentAssets.refreshStatus')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!asset.assetUri}
                  onClick={() => onCopyAssetUri(asset.assetUri)}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  {t('agentAssets.copyAssetUri')}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </Masonry>

      <div className="flex justify-center py-4 text-sm text-muted-foreground">
        {t('mediaManagement.loadedAll')}
        {' · '}
        {total}
        {' '}
        {t('mediaManagement.resources')}
      </div>
    </div>
  )
}

function PortraitStatusBadge({ status }: { status?: PortraitAssetVo['status'] }) {
  const { t } = useTransClient('material')
  const normalizedStatus = status || 'processing'
  const className = normalizedStatus === 'active'
    ? 'bg-emerald-50 text-emerald-700'
    : normalizedStatus === 'failed'
      ? 'bg-red-50 text-red-700'
      : 'bg-amber-50 text-amber-700'

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {normalizedStatus === 'active' && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {normalizedStatus === 'failed' && <XCircle className="mr-1 h-3 w-3" />}
      {normalizedStatus !== 'active' && normalizedStatus !== 'failed' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
      {t(`agentAssets.portraitStatus.${normalizedStatus}`)}
    </span>
  )
}
