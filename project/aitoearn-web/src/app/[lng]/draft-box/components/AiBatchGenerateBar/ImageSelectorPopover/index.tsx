/**
 * ImageSelectorPopover - 店铺图片选择弹出面板
 * 从品牌图片库中选择图片，side="bottom" 适配内联输入栏
 */

'use client'

import type { BrandImage } from '../index'
import { Check, ImagePlus, Play } from 'lucide-react'
import Image from 'next/image'
import { memo, useCallback, useRef, useState } from 'react'
import { useTransClient } from '@/app/i18n/client'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getOssUrl } from '@/utils/oss'

interface ImageSelectorPopoverProps {
  allImages: BrandImage[]
  selectedIds: string[]
  maxImages: number
  onImagesChange: (ids: string[]) => void
  onOpenChange?: (open: boolean) => void
  /** 外部受控 open 状态 */
  open?: boolean
  /** 本地已上传的图片数量，用于联动计算总配额 */
  localImageCount?: number
  children: React.ReactNode
}

type AssetSource = NonNullable<BrandImage['source']>

const ASSET_SOURCE_TABS: Array<{ value: AssetSource, labelKey: string, emptyKey: string }> = [
  { value: 'agent', labelKey: 'detail.agentGeneratedAssets', emptyKey: 'detail.noAgentAssets' },
  { value: 'local', labelKey: 'detail.localUploadedAssets', emptyKey: 'detail.noLocalAssets' },
  { value: 'portrait', labelKey: 'detail.portraitAssets', emptyKey: 'detail.noPortraitAssets' },
]

const ImageSelectorPopover = memo(({
  allImages,
  selectedIds,
  maxImages,
  onImagesChange,
  onOpenChange,
  open: controlledOpen,
  localImageCount = 0,
  children,
}: ImageSelectorPopoverProps) => {
  const { t } = useTransClient('brandPromotion')
  const [internalOpen, setInternalOpen] = useState(false)
  const [activeSource, setActiveSource] = useState<AssetSource>('agent')
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const lastToggleTimeRef = useRef(0)
  const activeImages = allImages.filter(image => (image.source ?? 'agent') === activeSource)
  const activeTab = ASSET_SOURCE_TABS.find(tab => tab.value === activeSource) ?? ASSET_SOURCE_TABS[0]

  const handleOpenChange = useCallback((newOpen: boolean) => {
    // 选择图片后 200ms 内忽略 close 事件，防止 re-render 导致 Popover 意外关闭
    if (!newOpen && Date.now() - lastToggleTimeRef.current < 200)
      return
    if (controlledOpen === undefined) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }, [onOpenChange, controlledOpen])

  const handleToggleImage = useCallback((imageId: string) => {
    lastToggleTimeRef.current = Date.now()
    const isSelected = selectedIds.includes(imageId)
    if (isSelected) {
      onImagesChange(selectedIds.filter(id => id !== imageId))
    }
    else if (selectedIds.length + localImageCount < maxImages) {
      onImagesChange([...selectedIds, imageId])
    }
  }, [selectedIds, maxImages, localImageCount, onImagesChange])

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        allowInnerScroll
        className="w-72 p-3"
        side="bottom"
        align="start"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{t('detail.selectImages')}</span>
          <span className="text-xs text-muted-foreground">
            {t('detail.selectedCount', { count: selectedIds.length + localImageCount })}
            {' / '}
            {t('detail.maxImages', { max: maxImages })}
          </span>
        </div>

        <div className="mb-3 inline-flex rounded-lg bg-sky-50 p-1">
          {ASSET_SOURCE_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              className={cn(
                'h-8 whitespace-nowrap rounded-md px-3 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900',
                activeSource === tab.value && 'bg-background text-slate-950 shadow-sm',
              )}
              onClick={() => setActiveSource(tab.value)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {activeImages.length === 0
          ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <ImagePlus className="mr-2 h-4 w-4" />
                {t(activeTab.emptyKey)}
              </div>
            )
          : (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {activeImages.map((image) => {
                  const isVideo = image.mediaType === 'video'
                  return (
                    <button
                      key={image.id}
                      type="button"
                      className="relative aspect-square rounded-md overflow-hidden cursor-pointer group border border-transparent hover:border-primary/50 transition-colors"
                      onClick={() => handleToggleImage(image.id)}
                      title={image.title}
                    >
                      {isVideo
                        ? (
                            <div className="relative h-full w-full bg-muted">
                              {image.thumbUrl
                                ? (
                                    <Image
                                      src={getOssUrl(image.thumbUrl)}
                                      alt=""
                                      fill
                                      className="object-cover"
                                      sizes="80px"
                                    />
                                  )
                                : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Play className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="rounded-full bg-black/60 p-1.5">
                                  <Play className="h-3 w-3 fill-white text-white" />
                                </div>
                              </div>
                            </div>
                          )
                        : (
                            <Image
                              src={getOssUrl(image.thumbUrl || image.url)}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          )}
                      {selectedIds.includes(image.id) && (
                        <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                      {!selectedIds.includes(image.id) && selectedIds.length + localImageCount >= maxImages && (
                        <div className="absolute inset-0 bg-background/50" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
      </PopoverContent>
    </Popover>
  )
})

ImageSelectorPopover.displayName = 'ImageSelectorPopover'

export default ImageSelectorPopover
