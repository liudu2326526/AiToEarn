import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { VolcengineConfig } from '../libs/volcengine'
import axios from 'axios'
import { createHash, createHmac } from 'crypto'

const ARK_ASSET_HOST = 'ark.cn-beijing.volcengineapi.com'
const ARK_ASSET_PATH = '/'
const ARK_ASSET_REGION = 'cn-beijing'
const ARK_ASSET_SERVICE = 'ark'
const ARK_ASSET_VERSION = '2024-01-01'
const ARK_ASSET_CONTENT_TYPE = 'application/json'

export interface ArkAssetResult {
  id?: string
  status: 'pending' | 'processing' | 'active' | 'failed'
  url?: string
  error?: string
  raw: Record<string, any>
}

@Injectable()
export class VolcengineArkAssetService {
  private readonly logger = new Logger(VolcengineArkAssetService.name)

  constructor(private readonly config: VolcengineConfig) {}

  get projectName() {
    return this.config.arkProjectName || 'default'
  }

  private assertConfigured() {
    if (!this.config.accessKeyId || !this.config.secretAccessKey) {
      throw new BadRequestException('Volcengine AK/SK is not configured')
    }
  }

  private normalizeQuery(params: Record<string, string>) {
    return Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&')
  }

  private hashSha256(content: string) {
    return createHash('sha256').update(content).digest('hex')
  }

  private hmacSha256(key: Buffer | string, content: string) {
    return createHmac('sha256', key).update(content).digest()
  }

  private buildHeaders(action: string, body: string, date = new Date()) {
    const query = { Action: action, Version: ARK_ASSET_VERSION }
    const xDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const shortDate = xDate.slice(0, 8)
    const xContentSha256 = this.hashSha256(body)
    const signedHeaders = 'content-type;host;x-content-sha256;x-date'

    const canonicalRequest = [
      'POST',
      ARK_ASSET_PATH,
      this.normalizeQuery(query),
      [
        `content-type:${ARK_ASSET_CONTENT_TYPE}`,
        `host:${ARK_ASSET_HOST}`,
        `x-content-sha256:${xContentSha256}`,
        `x-date:${xDate}`,
      ].join('\n'),
      '',
      signedHeaders,
      xContentSha256,
    ].join('\n')

    const credentialScope = [shortDate, ARK_ASSET_REGION, ARK_ASSET_SERVICE, 'request'].join('/')
    const stringToSign = [
      'HMAC-SHA256',
      xDate,
      credentialScope,
      this.hashSha256(canonicalRequest),
    ].join('\n')

    const kDate = this.hmacSha256(this.config.secretAccessKey, shortDate)
    const kRegion = this.hmacSha256(kDate, ARK_ASSET_REGION)
    const kService = this.hmacSha256(kRegion, ARK_ASSET_SERVICE)
    const kSigning = this.hmacSha256(kService, 'request')
    const signature = this.hmacSha256(kSigning, stringToSign).toString('hex')

    return {
      Host: ARK_ASSET_HOST,
      'X-Content-Sha256': xContentSha256,
      'X-Date': xDate,
      'Content-Type': ARK_ASSET_CONTENT_TYPE,
      Authorization: `HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    }
  }

  private extractError(payload: Record<string, any>, fallback: string) {
    const responseError = payload['ResponseMetadata']?.Error
    if (responseError?.Code && responseError?.Message) {
      return `${responseError.Code}: ${responseError.Message}`
    }
    return responseError?.Message || payload['ErrorMessage'] || payload['Message'] || payload['Error'] || fallback
  }

  private normalizeStatus(status: unknown): ArkAssetResult['status'] {
    const value = String(status || '').toLowerCase()
    if (value === 'active' || value === 'processing' || value === 'pending' || value === 'failed') {
      return value
    }
    return 'pending'
  }

  private normalizeAssetResponse(payload: Record<string, any>): ArkAssetResult {
    const result = typeof payload['Result'] === 'object' && payload['Result'] ? payload['Result'] : payload
    return {
      id: result.Id || result.AssetId,
      status: this.normalizeStatus(result.Status),
      url: result.URL,
      error: result.Error || result.ErrorMessage,
      raw: payload,
    }
  }

  private async request(action: string, payload: Record<string, any>) {
    this.assertConfigured()
    const body = JSON.stringify(payload)
    const headers = this.buildHeaders(action, body)
    const url = `https://${ARK_ASSET_HOST}${ARK_ASSET_PATH}?${this.normalizeQuery({ Action: action, Version: ARK_ASSET_VERSION })}`

    try {
      const response = await axios.post(url, body, {
        headers,
        timeout: 30000,
        transformRequest: data => data,
      })
      const data = response.data as Record<string, any>
      if (data['ResponseMetadata']?.Error) {
        throw new BadRequestException(this.extractError(data, 'Volcengine asset API error'))
      }
      return data
    }
    catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error
      }
      const payload = error.response?.data
      const detail = payload ? this.extractError(payload, error.message) : error.message
      this.logger.error({ action, detail }, 'Volcengine asset API request failed')
      throw new BadRequestException(`Volcengine asset API error: ${detail}`)
    }
  }

  async createAssetGroup(name: string, description = '') {
    const payload = {
      Name: name,
      Description: description,
      GroupType: 'AIGC',
      ProjectName: this.projectName,
    }
    const response = await this.request('CreateAssetGroup', payload)
    const groupId = response['Result']?.Id || response['Id']
    if (!groupId) {
      throw new BadRequestException('Volcengine asset group response missing id')
    }
    return { id: groupId as string, raw: response }
  }

  async createAsset(groupId: string, url: string, name?: string) {
    const payload: Record<string, any> = {
      GroupId: groupId,
      URL: url,
      AssetType: 'Image',
      ProjectName: this.projectName,
    }
    if (name) {
      payload['Name'] = name
    }
    const response = await this.request('CreateAsset', payload)
    const normalized = this.normalizeAssetResponse(response)
    if (!normalized.id) {
      throw new BadRequestException('Volcengine asset response missing id')
    }
    return normalized
  }

  async getAsset(assetId: string) {
    return this.normalizeAssetResponse(await this.request('GetAsset', {
      Id: assetId,
      ProjectName: this.projectName,
    }))
  }
}
