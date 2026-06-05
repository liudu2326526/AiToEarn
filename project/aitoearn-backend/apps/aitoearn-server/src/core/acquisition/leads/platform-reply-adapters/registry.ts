import type { PlatformReplyAdapter } from './index'
import { Injectable } from '@nestjs/common'
import { AppException, ResponseCode } from '@yikart/common'
import { DouyinCreatorReplyAdapter } from './douyin-creator-reply.adapter'
import { XhsBrowserPluginReplyAdapter } from './xhs-browser-plugin-reply.adapter'

@Injectable()
export class PlatformReplyAdapterRegistry {
  constructor(
    private readonly xhsAdapter: XhsBrowserPluginReplyAdapter,
    private readonly douyinAdapter: DouyinCreatorReplyAdapter,
  ) {}

  get(platform: string): PlatformReplyAdapter {
    if (platform === 'xhs')
      return this.xhsAdapter
    if (platform === 'douyin')
      return this.douyinAdapter
    throw new AppException(ResponseCode.PlatformNotSupported)
  }
}
