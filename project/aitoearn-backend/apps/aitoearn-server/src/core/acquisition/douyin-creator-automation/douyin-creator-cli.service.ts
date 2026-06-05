import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Injectable } from '@nestjs/common'

export interface DouyinCreatorCliConfig {
  toolsDir: string
  profileDir: string
  outputDir: string
  timeoutMs: number
  defaultDryRun: boolean
}

interface ReplyInput {
  plan: unknown
  dryRun: boolean
  limit?: number
}

export interface DouyinCreatorArticlePublishInput {
  title: string
  subtitle?: string
  content: string
  imagePath: string
  music?: string
  tags?: string[]
}

export interface DouyinCreatorImageTextPublishInput {
  title?: string
  description?: string
  imagePaths: string[]
  music?: string
}

@Injectable()
export class DouyinCreatorCliService {
  private readonly cliConfig: DouyinCreatorCliConfig
  private lastSuccessfulRunAt = ''

  constructor(cliConfig: DouyinCreatorCliConfig = buildDouyinCreatorCliConfigFromEnv()) {
    this.cliConfig = cliConfig
  }

  async getStatus() {
    const configured = await this.isToolsDirAvailable()
    return {
      configured,
      ready: configured && Boolean(this.lastSuccessfulRunAt),
      toolsDir: this.cliConfig.toolsDir,
      profileDir: this.cliConfig.profileDir,
      outputDir: this.cliConfig.outputDir,
      lastSuccessfulRunAt: this.lastSuccessfulRunAt,
      message: configured
        ? this.lastSuccessfulRunAt ? 'ready' : 'ready_to_probe'
        : `douyin_creator_tools_dir not found: ${this.cliConfig.toolsDir || '(empty)'}`,
    }
  }

  async exportComments(input: { workTitle?: string, exportAll?: boolean, limit?: number } = {}) {
    const outputPath = await this.createOutputPath('comments-export.json')
    const script = input.exportAll ? 'comments:export-all' : 'comments:export'
    const args = this.buildNpmArgs(script, [
      ...(input.limit ? ['--limit', String(input.limit)] : []),
      '--out',
      outputPath,
      ...(!input.exportAll && input.workTitle ? [input.workTitle] : []),
    ])
    return await this.runCli(args, outputPath)
  }

  async replyComments(input: ReplyInput) {
    const { outputPath, planPath } = await this.writeReplyPlan('comments-reply-result.json', input.plan)
    const args = this.buildNpmArgs('comments:reply', [
      ...(input.dryRun ? ['--dry-run'] : []),
      ...(input.limit ? ['--limit', String(input.limit)] : []),
      '--out',
      outputPath,
      planPath,
    ])
    return await this.runCli(args, outputPath)
  }

  async exportDms() {
    const outputPath = await this.createOutputPath('dm-export.json')
    const args = this.buildNpmArgs('dm:export', ['--out', outputPath])
    return await this.runCli(args, outputPath)
  }

  async replyDms(input: ReplyInput) {
    const { outputPath, planPath } = await this.writeReplyPlan('dm-reply-result.json', input.plan)
    const args = this.buildNpmArgs('dm:reply', [
      ...(input.dryRun ? ['--dry-run'] : []),
      ...(input.limit ? ['--limit', String(input.limit)] : []),
      '--out',
      outputPath,
      planPath,
    ])
    return await this.runCli(args, outputPath)
  }

  async prepareArticlePublishDryRun(input: DouyinCreatorArticlePublishInput) {
    const inputPath = await this.writePublishInput('article-publish-input.json', {
      title: input.title,
      subtitle: input.subtitle || '',
      content: input.content,
      imagePath: input.imagePath,
      music: input.music || '',
      tags: input.tags || [],
    })
    return this.buildPublishPrepareResult('article_publish_prepare', 'article:publish', inputPath)
  }

  async prepareImageTextPublishDryRun(input: DouyinCreatorImageTextPublishInput) {
    const inputPath = await this.writePublishInput('imagetext-publish-input.json', {
      title: input.title || '',
      description: input.description || '',
      imagePaths: input.imagePaths,
      music: input.music || '',
    })
    return this.buildPublishPrepareResult('imagetext_publish_prepare', 'imagetext:publish', inputPath)
  }

  private buildNpmArgs(script: string, scriptArgs: string[]) {
    const sharedArgs = this.cliConfig.profileDir ? ['--profile', this.cliConfig.profileDir] : []
    return ['run', script, '--', ...sharedArgs, ...scriptArgs]
  }

  private async writeReplyPlan(filename: string, plan: unknown) {
    const runDir = await this.createRunDir()
    const planPath = path.join(runDir, 'reply-plan.json')
    const outputPath = path.join(runDir, filename)
    await fs.writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8')
    return { outputPath, planPath }
  }

  private async writePublishInput(filename: string, input: unknown) {
    if (!(await this.isToolsDirAvailable())) {
      throw new Error('douyin_creator_tools_dir_not_found')
    }
    const runDir = await this.createRunDir()
    const inputPath = path.join(runDir, filename)
    await fs.writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, 'utf8')
    return inputPath
  }

  private buildPublishPrepareResult(mode: string, script: string, inputPath: string) {
    const command = ['npm', ...this.buildNpmArgs(script, ['--dry-run', inputPath])]
    const escapedCommand = command.map(part => shellQuote(part)).join(' ')
    return {
      mode,
      dryRun: true,
      toolsDir: this.cliConfig.toolsDir,
      profileDir: this.cliConfig.profileDir,
      inputPath,
      command,
      commandText: `cd ${shellQuote(this.cliConfig.toolsDir)} && ${escapedCommand}`,
      message: 'Run this command locally to open a visible Douyin Creator Center browser and fill the publish form without clicking publish.',
    }
  }

  private async createOutputPath(filename: string) {
    const runDir = await this.createRunDir()
    return path.join(runDir, filename)
  }

  private async createRunDir() {
    const runDir = path.join(this.cliConfig.outputDir, `${Date.now()}-${randomUUID()}`)
    await fs.mkdir(runDir, { recursive: true })
    return runDir
  }

  private async isToolsDirAvailable() {
    if (!this.cliConfig.toolsDir)
      return false
    try {
      const stat = await fs.stat(this.cliConfig.toolsDir)
      return stat.isDirectory()
    }
    catch {
      return false
    }
  }

  private async runCli(args: string[], outputPath: string): Promise<Record<string, unknown>> {
    if (!(await this.isToolsDirAvailable())) {
      throw new Error('douyin_creator_tools_dir_not_found')
    }

    const child = spawn('npm', args, {
      cwd: this.cliConfig.toolsDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(() => {
        timedOut = true
        child.kill()
      }, this.cliConfig.timeoutMs)

      child.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      child.on('close', (code) => {
        clearTimeout(timeout)
        resolve(code)
      })
    })

    if (timedOut) {
      throw new Error(`douyin_creator_cli_timeout: ${stderr || stdout}`.trim())
    }
    if (exitCode !== 0) {
      throw new Error(`douyin_creator_cli_failed: ${stderr || stdout}`.trim())
    }

    const result = JSON.parse(await fs.readFile(outputPath, 'utf8')) as Record<string, unknown>
    this.lastSuccessfulRunAt = new Date().toISOString()
    return {
      ...result,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      outputPath,
    }
  }
}

function booleanFromEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '')
    return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function shellQuote(value: string) {
  if (/^[\w./:=@%+-]+$/.test(value))
    return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function buildDouyinCreatorCliConfigFromEnv(): DouyinCreatorCliConfig {
  return {
    toolsDir: process.env['DOUYIN_CREATOR_TOOLS_DIR'] || '',
    profileDir: process.env['DOUYIN_CREATOR_PROFILE_DIR'] || '',
    outputDir: process.env['DOUYIN_CREATOR_OUTPUT_DIR'] || '/tmp/aitoearn-douyin-creator',
    timeoutMs: Number(process.env['DOUYIN_CREATOR_TIMEOUT_MS'] || 180000),
    defaultDryRun: booleanFromEnv(process.env['DOUYIN_CREATOR_DEFAULT_DRY_RUN'], true),
  }
}
