import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DouyinCreatorCliService } from './douyin-creator-cli.service'

const spawnMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}))

class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  killed = false

  kill() {
    this.killed = true
    this.emit('close', null)
    return true
  }
}

describe('douyinCreatorCliService', () => {
  let tmpDir: string
  let toolsDir: string
  let outputDir: string

  beforeEach(async () => {
    vi.clearAllMocks()
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'douyin-creator-cli-'))
    toolsDir = path.join(tmpDir, 'tools')
    outputDir = path.join(tmpDir, 'out')
    await fs.mkdir(toolsDir, { recursive: true })
  })

  it('reports unavailable when the tool directory is missing', async () => {
    const service = new DouyinCreatorCliService({
      toolsDir: path.join(tmpDir, 'missing-tools'),
      profileDir: '',
      outputDir,
      timeoutMs: 1000,
      defaultDryRun: true,
    })

    await expect(service.getStatus()).resolves.toEqual(expect.objectContaining({
      configured: false,
      message: expect.stringContaining('not found'),
    }))
  })

  it('runs comments reply with dry-run and parses the output JSON', async () => {
    const service = new DouyinCreatorCliService({
      toolsDir,
      profileDir: '/tmp/profile',
      outputDir,
      timeoutMs: 1000,
      defaultDryRun: true,
    })
    let capturedArgs: string[] = []

    spawnMock.mockImplementation((_command: string, args: string[]) => {
      capturedArgs = args
      const child = new FakeChildProcess()
      queueMicrotask(async () => {
        const outIndex = args.indexOf('--out')
        await fs.writeFile(args[outIndex + 1], JSON.stringify({ sentCount: 0, dryRunCount: 1 }), 'utf8')
        child.stdout.end('ok')
        child.stderr.end('')
        child.emit('close', 0)
      })
      return child
    })

    const result = await service.replyComments({
      plan: { comments: [{ username: '用户A', commentText: '想了解', replyMessage: '你好' }] },
      dryRun: true,
      limit: 1,
    })

    expect(spawnMock).toHaveBeenCalledWith('npm', expect.any(Array), expect.objectContaining({ cwd: toolsDir }))
    expect(capturedArgs).toEqual(expect.arrayContaining(['run', 'comments:reply', '--', '--dry-run', '--limit', '1']))
    expect(result).toEqual(expect.objectContaining({ sentCount: 0, dryRunCount: 1 }))
    expect(result).toEqual(expect.objectContaining({ stdout: 'ok' }))
  })

  it('runs dm export with profile and output arguments supported by the external CLI', async () => {
    const service = new DouyinCreatorCliService({
      toolsDir,
      profileDir: '/tmp/profile',
      outputDir,
      timeoutMs: 1000,
      defaultDryRun: true,
    })
    let capturedArgs: string[] = []

    spawnMock.mockImplementation((_command: string, args: string[]) => {
      capturedArgs = args
      const child = new FakeChildProcess()
      queueMicrotask(async () => {
        const outIndex = args.indexOf('--out')
        await fs.writeFile(args[outIndex + 1], JSON.stringify({ conversations: [] }), 'utf8')
        child.emit('close', 0)
      })
      return child
    })

    await service.exportDms()

    expect(capturedArgs).toEqual(expect.arrayContaining(['run', 'dm:export', '--', '--profile', '/tmp/profile', '--out']))
    expect(capturedArgs).not.toContain('--limit')
  })

  it('prepares an article publish dry-run command without starting the browser', async () => {
    const service = new DouyinCreatorCliService({
      toolsDir,
      profileDir: '/tmp/profile',
      outputDir,
      timeoutMs: 1000,
      defaultDryRun: true,
    })

    const result = await service.prepareArticlePublishDryRun({
      title: '文章标题',
      subtitle: '摘要',
      content: '正文',
      imagePath: '/tmp/cover.png',
      music: '星际穿越',
      tags: ['标签1'],
    })
    const inputJson = JSON.parse(await fs.readFile(String(result['inputPath']), 'utf8'))

    expect(spawnMock).not.toHaveBeenCalled()
    expect(inputJson).toEqual({
      title: '文章标题',
      subtitle: '摘要',
      content: '正文',
      imagePath: '/tmp/cover.png',
      music: '星际穿越',
      tags: ['标签1'],
    })
    expect(result).toEqual(expect.objectContaining({
      mode: 'article_publish_prepare',
      dryRun: true,
      command: ['npm', 'run', 'article:publish', '--', '--profile', '/tmp/profile', '--dry-run', String(result['inputPath'])],
      commandText: `cd ${toolsDir} && npm run article:publish -- --profile /tmp/profile --dry-run ${String(result['inputPath'])}`,
    }))
  })

  it('prepares an image-text publish dry-run command without starting the browser', async () => {
    const service = new DouyinCreatorCliService({
      toolsDir,
      profileDir: '/tmp/profile',
      outputDir,
      timeoutMs: 1000,
      defaultDryRun: true,
    })

    const result = await service.prepareImageTextPublishDryRun({
      title: '图文标题',
      description: '图文描述',
      imagePaths: ['/tmp/1.png', '/tmp/2.png'],
      music: '',
    })
    const inputJson = JSON.parse(await fs.readFile(String(result['inputPath']), 'utf8'))

    expect(spawnMock).not.toHaveBeenCalled()
    expect(inputJson).toEqual({
      title: '图文标题',
      description: '图文描述',
      imagePaths: ['/tmp/1.png', '/tmp/2.png'],
      music: '',
    })
    expect(result).toEqual(expect.objectContaining({
      mode: 'imagetext_publish_prepare',
      dryRun: true,
      command: ['npm', 'run', 'imagetext:publish', '--', '--profile', '/tmp/profile', '--dry-run', String(result['inputPath'])],
    }))
  })

  it('returns a typed failure when the CLI exits non-zero', async () => {
    const service = new DouyinCreatorCliService({
      toolsDir,
      profileDir: '',
      outputDir,
      timeoutMs: 1000,
      defaultDryRun: true,
    })

    spawnMock.mockImplementation(() => {
      const child = new FakeChildProcess()
      queueMicrotask(() => {
        child.stderr.end('login required')
        child.emit('close', 1)
      })
      return child
    })

    await expect(service.exportDms()).rejects.toThrow('douyin_creator_cli_failed')
  })

  it('kills the CLI process when it times out', async () => {
    const service = new DouyinCreatorCliService({
      toolsDir,
      profileDir: '',
      outputDir,
      timeoutMs: 1,
      defaultDryRun: true,
    })
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)

    await expect(service.exportDms()).rejects.toThrow('douyin_creator_cli_timeout')
    expect(child.killed).toBe(true)
  })
})
