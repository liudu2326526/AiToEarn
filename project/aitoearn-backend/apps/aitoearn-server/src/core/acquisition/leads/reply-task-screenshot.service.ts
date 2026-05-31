import { Injectable } from '@nestjs/common'
import { AssetsService } from '@yikart/assets'
import { AppException, ResponseCode } from '@yikart/common'
import { AssetType } from '@yikart/mongodb'

const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024
const DATA_URL_RE = /^data:(image\/png|image\/jpeg|image\/webp);base64,([a-z0-9+/=]+)$/i

@Injectable()
export class ReplyTaskScreenshotService {
  constructor(private readonly assetsService: AssetsService) {}

  async uploadScreenshot(userId: string, taskId: string, screenshotDataUrl?: string): Promise<string> {
    if (!screenshotDataUrl) return ''

    const match = screenshotDataUrl.match(DATA_URL_RE)
    if (!match) {
      throw new AppException(ResponseCode.ValidationFailed, 'Invalid screenshot data URL')
    }

    const mimeType = match[1].toLowerCase()
    const buffer = Buffer.from(match[2], 'base64')
    if (!buffer.length) return ''
    if (buffer.length > MAX_SCREENSHOT_BYTES) {
      throw new AppException(ResponseCode.AssetTooLarge, 'Screenshot is too large')
    }

    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1]
    const result = await this.assetsService.uploadFromBuffer(userId, buffer, {
      type: AssetType.Temp,
      mimeType,
      filename: `${taskId}.${ext}`,
    }, `lead-reply-task/${taskId}`)

    return result.url
  }
}
