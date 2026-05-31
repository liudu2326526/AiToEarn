import { Injectable } from '@nestjs/common'
import { AppException, ResponseCode } from '@yikart/common'
import type { PlatformReplyAdapter } from './index'
import { XhsBrowserPluginReplyAdapter } from './xhs-browser-plugin-reply.adapter'

@Injectable()
export class PlatformReplyAdapterRegistry {
  constructor(private readonly xhsAdapter: XhsBrowserPluginReplyAdapter) {}

  get(platform: string): PlatformReplyAdapter {
    if (platform === 'xhs') return this.xhsAdapter
    throw new AppException(ResponseCode.PlatformNotSupported)
  }
}
