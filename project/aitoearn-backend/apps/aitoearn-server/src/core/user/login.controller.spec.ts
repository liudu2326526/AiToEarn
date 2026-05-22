import { AppException } from '@yikart/common'
import { describe, expect, it, vi } from 'vitest'
import { encryptPassword } from '../../common/utils/password.util'
import { LoginController } from './login.controller'

vi.mock('../../config', () => ({
  config: {
    environment: 'test',
    superCode: '',
  },
}))

vi.mock('./user.service', () => ({
  UserService: class {},
}))

vi.mock('./login.service', () => ({
  LoginService: class {},
}))

vi.mock('@yikart/assets', () => ({
  assetsConfigSchema: {},
}))

vi.mock('@yikart/channel-db', () => ({
  mongodbConfigSchema: {},
}))

vi.mock('@yikart/mongodb', () => ({
  AssetStatus: {
    Active: 'Active',
    Deleted: 'Deleted',
  },
  AssetType: {
    AiImage: 'AiImage',
    AiVideo: 'AiVideo',
    AiCard: 'AiCard',
    AiChatImage: 'AiChatImage',
    AideoOutput: 'AideoOutput',
    VideoEdit: 'VideoEdit',
    DramaRecap: 'DramaRecap',
    StyleTransfer: 'StyleTransfer',
    UserMedia: 'UserMedia',
    UserFile: 'UserFile',
    PublishMedia: 'PublishMedia',
    Avatar: 'Avatar',
    AgentSession: 'AgentSession',
    VideoThumbnail: 'VideoThumbnail',
    Temp: 'Temp',
    ImageEdit: 'ImageEdit',
    Subtitle: 'Subtitle',
  },
  UserStatus: {
    OPEN: 1,
    STOP: 0,
  },
  mongodbConfigSchema: {},
}))

describe('LoginController password login', () => {
  function createController(overrides: {
    user?: Record<string, any> | null
  } = {}) {
    const authService = {
      generateToken: vi.fn(() => 'token-value'),
      decodeToken: vi.fn(() => ({ exp: 123456 })),
    }
    const userService = {
      getUserInfoByMail: vi.fn(async () => overrides.user),
      afterLogin: vi.fn(async () => true),
    }
    const controller = new LoginController(
      authService as any,
      userService as any,
      {} as any,
      {} as any,
    )

    return { controller: controller as any, authService, userService }
  }

  it('returns a token for a valid email and password', async () => {
    const encrypted = encryptPassword('secret123')
    const user = {
      id: 'user-1',
      mail: 'admin@example.com',
      name: 'Admin',
      status: 1,
      ...encrypted,
    }
    const { controller, authService, userService } = createController({ user })

    const result = await controller.loginByPassword({
      mail: 'admin@example.com',
      password: 'secret123',
    })

    expect(userService.getUserInfoByMail).toHaveBeenCalledWith('admin@example.com', true)
    expect(authService.generateToken).toHaveBeenCalledWith(user)
    expect(userService.afterLogin).toHaveBeenCalledWith(user)
    expect(result).toMatchObject({
      type: 'login',
      token: 'token-value',
      exp: 123456,
      userInfo: user,
    })
  })

  it('rejects an incorrect password', async () => {
    const encrypted = encryptPassword('secret123')
    const user = {
      id: 'user-1',
      mail: 'admin@example.com',
      name: 'Admin',
      status: 1,
      ...encrypted,
    }
    const { controller } = createController({ user })

    await expect(controller.loginByPassword({
      mail: 'admin@example.com',
      password: 'wrong-password',
    })).rejects.toBeInstanceOf(AppException)
  })
})
