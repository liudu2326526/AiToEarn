'use client'

import {
  CheckCircle2,
  ChevronRight,
  Download,
  FolderOpen,
  HelpCircle,
  PlugZap,
  Puzzle,
  Search,
  ShieldCheck,
  ZoomIn,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { MediaPreview } from '@/components/common/MediaPreview'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PublicImageAsset {
  src: string
  width: number
  height: number
}

const DOWNLOAD_URL = '/downloads/aitobee-xhs-bridge.zip'
const EXTENSION_FOLDER = 'xhs-bridge'

const guideImages = [
  {
    src: '/assets/plugin-guide-images/aitobee-xhs-guide-download.png',
    width: 1280,
    height: 760,
    title: '下载并解压插件包',
  },
  {
    src: '/assets/plugin-guide-images/aitobee-xhs-guide-extensions.png',
    width: 1280,
    height: 760,
    title: '打开 Chrome 扩展程序页面',
  },
  {
    src: '/assets/plugin-guide-images/aitobee-xhs-guide-load.png',
    width: 1280,
    height: 760,
    title: '加载 xhs-bridge 文件夹',
  },
  {
    src: '/assets/plugin-guide-images/aitobee-xhs-guide-popup.png',
    width: 1280,
    height: 760,
    title: '连接 AitoBee 本地服务',
  },
  {
    src: '/assets/plugin-guide-images/aitobee-xhs-guide-search.png',
    width: 1280,
    height: 760,
    title: '开始小红书评论检索',
  },
] satisfies Array<PublicImageAsset & { title: string }>

const toc = [
  { id: 'download', label: '下载插件包' },
  { id: 'install', label: '安装到 Chrome' },
  { id: 'connect', label: '连接 AitoBee' },
  { id: 'use-xhs', label: '开始抓取数据' },
  { id: 'faq', label: '常见问题' },
]

interface StepCardProps {
  stepNumber: number
  title: string
  children: React.ReactNode
  icon?: React.ReactNode
}

function StepCard({ stepNumber, title, children, icon }: StepCardProps) {
  return (
    <div className="relative">
      <div className="absolute bottom-0 left-[18px] top-14 w-[2px] bg-gradient-to-b from-sky-300/60 to-sky-100" />
      <div className="flex gap-4 md:gap-6">
        <div className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-semibold text-white shadow-md shadow-sky-200">
          {stepNumber}
        </div>
        <div className="flex-1 pb-8 md:pb-12">
          <div className="mb-3 flex items-center gap-2">
            {icon}
            <h3 className="text-lg font-semibold text-slate-950 md:text-xl">{title}</h3>
          </div>
          <div className="space-y-4 text-slate-600">{children}</div>
        </div>
      </div>
    </div>
  )
}

interface GuideImageProps {
  image: PublicImageAsset
  alt: string
  caption?: string
  className?: string
  onClick?: () => void
}

function GuideImage({ image, alt, caption, className, onClick }: GuideImageProps) {
  return (
    <figure className={cn('my-4', className)}>
      <button
        type="button"
        className="group relative block w-full overflow-hidden rounded-xl border border-sky-100 bg-white p-1.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-sky-100"
        onClick={onClick}
      >
        <Image
          src={image.src}
          alt={alt}
          className="h-auto max-h-[520px] w-full rounded-md object-contain"
          width={image.width}
          height={image.height}
          priority={false}
          quality={100}
        />
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/0 transition-all group-hover:bg-black/10">
          <div className="scale-90 rounded-full bg-white/95 p-2 opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
            <ZoomIn className="h-5 w-5 text-sky-500" />
          </div>
        </div>
      </button>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-slate-500">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

function TableOfContents() {
  return (
    <Card className="relative h-fit overflow-hidden border-sky-100 bg-white p-4 shadow-sm">
      <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-sky-400 to-indigo-400" />
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">目录</h4>
      <nav className="space-y-1">
        {toc.map(section => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="flex items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm text-slate-600 transition-all hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
          >
            <ChevronRight className="h-3 w-3" />
            {section.label}
          </a>
        ))}
      </nav>
    </Card>
  )
}

function SectionTitle({ id, icon, title }: { id: string, icon: React.ReactNode, title: string }) {
  return (
    <div id={id} className="mb-6 flex scroll-mt-6 items-center gap-3 rounded-xl border-l-4 border-sky-300 bg-sky-50/70 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sky-500 shadow-sm">
        {icon}
      </div>
      <h2 className="text-2xl font-bold text-slate-950 md:text-3xl">{title}</h2>
    </div>
  )
}

export default function PluginGuideContent() {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  const openPreview = useCallback((index: number) => {
    setPreviewIndex(index)
    setPreviewOpen(true)
  }, [])

  const closePreview = useCallback(() => {
    setPreviewOpen(false)
  }, [])

  const previewItems = guideImages.map(image => ({
    type: 'image' as const,
    src: image.src,
    title: image.title,
  }))

  return (
    <div className="relative min-h-screen bg-[#f6fbff] text-slate-950">
      <MediaPreview
        open={previewOpen}
        items={previewItems}
        initialIndex={previewIndex}
        onClose={closePreview}
      />

      <header className="border-b border-sky-100 bg-gradient-to-b from-sky-50 to-white">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-1.5 shadow-sm">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-indigo-500">
                <Puzzle className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-600">AitoBee XHS Bridge</span>
            </div>
            <h1 className="mb-4 text-3xl font-bold tracking-normal text-slate-950 md:text-4xl">
              浏览器插件安装指南
            </h1>
            <p className="text-lg leading-8 text-slate-600">
              当前本地版使用 AitoBee 自有 Chrome 扩展连接本机 WebSocket Bridge，用于读取你已登录小红书页面中的作品和评论数据。
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={DOWNLOAD_URL}
                download
                className="inline-flex h-11 items-center gap-2 rounded-md bg-gradient-to-r from-sky-400 to-indigo-500 px-5 text-sm font-semibold text-white shadow-sm shadow-sky-200 transition hover:from-sky-500 hover:to-indigo-600"
              >
                <Download className="h-4 w-4" />
                下载插件包
              </a>
              <Link
                href="/zh-CN/xhs-data"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-sky-200 bg-white px-5 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
              >
                <Search className="h-4 w-4" />
                返回小红书数据
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="hidden w-64 shrink-0 self-start lg:sticky lg:top-6 lg:block">
            <TableOfContents />
          </aside>

          <main className="max-w-4xl flex-1">
            <Alert className="mb-8 border-sky-100 bg-white shadow-sm">
              <HelpCircle className="h-4 w-4 text-sky-500" />
              <div className="min-w-0 flex-1">
                <AlertTitle className="text-slate-950">安装前确认</AlertTitle>
                <AlertDescription className="text-slate-600">
                  请先启动 AitoBee 本地后端，确认本机 WebSocket Bridge 地址
                  <code className="mx-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">ws://127.0.0.1:9333</code>
                  可用。扩展只在你的本机浏览器和本机服务之间通信。
                </AlertDescription>
              </div>
            </Alert>

            <section className="mb-12">
              <SectionTitle id="download" icon={<Download className="h-5 w-5" />} title="下载插件包" />
              <StepCard stepNumber={1} title="下载并解压 AitoBee XHS Bridge">
                <p>
                  点击页面上方或下方的“下载插件包”，下载
                  <code className="mx-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">aitobee-xhs-bridge.zip</code>
                  。下载完成后先解压，得到
                  <code className="mx-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">{EXTENSION_FOLDER}</code>
                  文件夹。
                </p>
                <a
                  href={DOWNLOAD_URL}
                  download
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-500 px-4 text-sm font-semibold text-white transition hover:bg-sky-600"
                >
                  <Download className="h-4 w-4" />
                  下载 aitobee-xhs-bridge.zip
                </a>
                <GuideImage
                  image={guideImages[0]}
                  alt="下载并解压 AitoBee XHS Bridge 插件包"
                  caption="下载后需要先解压，Chrome 加载的是解压后的 xhs-bridge 文件夹。"
                  onClick={() => openPreview(0)}
                />
              </StepCard>
            </section>

            <section className="mb-12">
              <SectionTitle id="install" icon={<FolderOpen className="h-5 w-5" />} title="安装到 Chrome" />
              <StepCard stepNumber={2} title="打开扩展程序页面并开启开发者模式">
                <p>
                  在 Chrome 地址栏输入
                  <code className="mx-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">chrome://extensions</code>
                  ，打开右上角“开发者模式”，然后点击“加载已解压的扩展程序”。
                </p>
                <GuideImage
                  image={guideImages[1]}
                  alt="Chrome 扩展程序页面开启开发者模式"
                  caption="本地版使用开发者模式加载已解压插件。"
                  onClick={() => openPreview(1)}
                />
              </StepCard>

              <StepCard stepNumber={3} title="选择 xhs-bridge 文件夹">
                <p>
                  在文件选择框中选择刚刚解压出来的
                  <code className="mx-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">{EXTENSION_FOLDER}</code>
                  文件夹。不要选择 zip 文件，也不要只选择其中的
                  <code className="mx-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">manifest.json</code>
                  文件。
                </p>
                <GuideImage
                  image={guideImages[2]}
                  alt="选择 xhs-bridge 文件夹"
                  caption="安装成功后，扩展列表中会出现 AitoBee XHS Bridge。"
                  onClick={() => openPreview(2)}
                />
              </StepCard>
            </section>

            <section className="mb-12">
              <SectionTitle id="connect" icon={<PlugZap className="h-5 w-5" />} title="连接 AitoBee" />
              <StepCard stepNumber={4} title="点击扩展图标并连接本地服务">
                <p>
                  保持 AitoBee 本地后端运行，点击 Chrome 工具栏里的 AitoBee XHS Bridge 扩展，点击“连接 AitoBee”。
                  状态显示“已连接 AitoBee”后，前端“小红书数据”页面会显示浏览器插件已就绪。
                </p>
                <GuideImage
                  image={guideImages[3]}
                  alt="AitoBee XHS Bridge 扩展弹窗"
                  caption="扩展连接的是 ws://127.0.0.1:9333，不需要额外启动 Python bridge_server.py。"
                  onClick={() => openPreview(3)}
                />
              </StepCard>
            </section>

            <section className="mb-12">
              <SectionTitle id="use-xhs" icon={<ShieldCheck className="h-5 w-5" />} title="开始抓取数据" />
              <StepCard stepNumber={5} title="登录小红书并打开评论检索">
                <p>
                  在同一个 Chrome 浏览器中登录小红书。回到 AitoBee，进入“小红书数据”，在评论检索中输入小红书作品链接，
                  可选输入关键词后点击“检索”。插件会使用你当前浏览器里的登录态读取评论。
                </p>
                <GuideImage
                  image={guideImages[4]}
                  alt="AitoBee 小红书评论检索"
                  caption="关键词筛选会在已抓取评论中实时过滤，支持评论内容、昵称、用户 ID 和子评论。"
                  onClick={() => openPreview(4)}
                />
              </StepCard>

              <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-indigo-50 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-md shadow-sky-200">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold text-slate-950">完成</h3>
                    <p className="text-slate-600">
                      之后只要本地后端和扩展保持连接，就可以在“小红书数据”里抓取作品详情、评论并做关键词检索。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <SectionTitle id="faq" icon={<HelpCircle className="h-5 w-5" />} title="常见问题" />
              <div className="space-y-4">
                <Card className="border-sky-100 bg-white p-6 shadow-sm">
                  <h4 className="mb-2 font-semibold text-slate-950">Q: 为什么页面提示“浏览器扩展未连接”？</h4>
                  <p className="text-slate-600">
                    先确认后端正在运行，再打开扩展弹窗点击“连接 AitoBee”。如果刚更新过插件代码，需要在
                    <code className="mx-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">chrome://extensions</code>
                    点击“重新加载”该扩展。
                  </p>
                </Card>
                <Card className="border-sky-100 bg-white p-6 shadow-sm">
                  <h4 className="mb-2 font-semibold text-slate-950">Q: 为什么抓取不到小红书数据？</h4>
                  <p className="text-slate-600">
                    请确认同一个 Chrome 里已经登录小红书，并且作品链接可以在浏览器中正常打开。部分小红书页面可能要求验证码或刷新登录态。
                  </p>
                </Card>
                <Card className="border-sky-100 bg-white p-6 shadow-sm">
                  <h4 className="mb-2 font-semibold text-slate-950">Q: 是否还需要运行 python scripts/bridge_server.py？</h4>
                  <p className="text-slate-600">
                    不需要。当前方案已经由 AitoBee 本地后端内置 WebSocket Bridge，扩展直接连接
                    <code className="mx-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">ws://127.0.0.1:9333</code>
                    。
                  </p>
                </Card>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
