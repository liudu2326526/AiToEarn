import { AppException } from '@yikart/common'
import { describe, expect, it, vi } from 'vitest'
import { encryptPassword } from '../../common/utils/password.util'
import { LoginController } from './login.controller'

vi.mock('../../config', () => ({
  config: {
    environment: 'test',
    superCode: '',
    mail: {
      transport: {
        auth: {
          user: '',
          pass: '',
        },
      },
    },
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
    createdUser?: Record<string, any>
    registerCode?: string
    mailSent?: boolean
  } = {}) {
    const authService = {
      generateToken: vi.fn(() => 'token-value'),
      decodeToken: vi.fn(() => ({ exp: 123456 })),
    }
    const userService = {
      getUserInfoByMail: vi.fn(async () => overrides.user),
      createUserByMailWithPassword: vi.fn(async (_mail: string, password: string, salt: string) => ({
        id: 'user-new',
        mail: 'new@example.com',
        name: 'new@example.com',
        status: 1,
        password,
        salt,
        ...(overrides.createdUser ?? {}),
      })),
      afterLogin: vi.fn(async () => true),
    }
    const redisService = {
      setJson: vi.fn(async () => true),
      getJson: vi.fn(async () => overrides.registerCode ? { code: overrides.registerCode } : null),
      del: vi.fn(async () => true),
    }
    const loginService = {
      sendLoginMail: vi.fn(async () => overrides.mailSent ?? true),
    }
    const controller = new LoginController(
      authService as any,
      userService as any,
      redisService as any,
      loginService as any,
    )

    return { controller: controller as any, authService, userService, redisService, loginService }
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

  it('sends a separate email registration code for a new email', async () => {
    const { controller, loginService, redisService } = createController({ user: null })

    const result = await controller.sendRegisterMailCode({
      mail: 'new@example.com',
    })

    expect(result).toMatch(/^\d{6}$/)
    expect(loginService.sendLoginMail).not.toHaveBeenCalled()
    expect(redisService.setJson).toHaveBeenCalledWith(
      'userMailRegister:new@example.com',
      { code: expect.stringMatching(/^\d{6}$/) },
      60 * 5,
    )
  })

  it('rejects registration code requests for an active existing email', async () => {
    const { controller } = createController({
      user: {
        id: 'user-1',
        mail: 'admin@example.com',
        status: 1,
        isDelete: false,
      },
    })

    await expect(controller.sendRegisterMailCode({
      mail: 'admin@example.com',
    })).rejects.toBeInstanceOf(AppException)
  })

  it('creates a password user after verifying the email registration code', async () => {
    const { controller, userService, redisService, authService } = createController({
      user: null,
      registerCode: '123456',
    })

    const result = await controller.registerByMailPassword({
      mail: 'new@example.com',
      code: '123456',
      password: 'secret123',
    })

    expect(redisService.getJson).toHaveBeenCalledWith('userMailRegister:new@example.com')
    expect(redisService.del).toHaveBeenCalledWith('userMailRegister:new@example.com')
    expect(userService.createUserByMailWithPassword).toHaveBeenCalledWith(
      'new@example.com',
      expect.any(String),
      expect.any(String),
    )
    expect(authService.generateToken).toHaveBeenCalledWith(expect.objectContaining({
      mail: 'new@example.com',
    }))
    expect(result).toMatchObject({
      type: 'regist',
      token: 'token-value',
      exp: 123456,
      userInfo: expect.objectContaining({
        mail: 'new@example.com',
      }),
    })
  })

  it('rejects password registration when the email code is invalid', async () => {
    const { controller } = createController({
      user: null,
      registerCode: '123456',
    })

    await expect(controller.registerByMailPassword({
      mail: 'new@example.com',
      code: '000000',
      password: 'secret123',
    })).rejects.toBeInstanceOf(AppException)
  })
})
