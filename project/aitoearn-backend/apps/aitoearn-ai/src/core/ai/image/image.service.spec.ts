import { config } from '../../../config'
import { ImageService } from './image.service'
import { vi } from 'vitest'

describe('imageService.generation', () => {
  const originalFetch = globalThis.fetch
  const originalMuskapis = (config.ai as any).muskapis

  afterEach(() => {
    globalThis.fetch = originalFetch
    ;(config.ai as any).muskapis = originalMuskapis
    vi.restoreAllMocks()
  })

  it('routes GPT Image 2 generation through Muskapis image generations and uploads the returned data uri', async () => {
    const uploadFromBuffer = vi.fn().mockResolvedValue({ asset: { path: 'ai/images/gpt-image-2/generated.png' } })
    const createImageGeneration = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        created: 123,
        data: [
          {
            url: 'data:image/png;base64,aGVsbG8=',
          },
        ],
      }),
    })

    globalThis.fetch = fetchMock as unknown as typeof fetch
    ;(config.ai as any).muskapis = {
      imageChatCompletionsUrl: 'https://api.muskapis.com/v1/chat/completions',
      imageGenerationsUrl: 'https://api.muskapis.com/v1/images/generations',
      apiKey: 'test-key',
    }

    const service = new ImageService(
      { uploadFromBuffer } as any,
      { createImageGeneration } as any,
      {} as any,
      {} as any,
      {} as any,
      {
        config: {
          image: {
            generation: [{ name: 'gpt-image-2', sizes: [], qualities: [], styles: [] }],
            edit: [],
          },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
    )

    const result = await service.generation({
      user: 'user-1',
      model: 'gpt-image-2',
      prompt: 'a blue product photo',
      n: 1,
      size: '1024x1024',
    } as any)

    expect(createImageGeneration).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.muskapis.com/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        }),
      }),
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(expect.objectContaining({
      model: 'gpt-image-2',
      size: '1024x1024',
    }))
    expect(uploadFromBuffer).toHaveBeenCalledWith(
      'user-1',
      Buffer.from('hello'),
      { type: expect.any(String), mimeType: 'image/png' },
      'ai/images/gpt-image-2',
    )
    expect(result.list).toEqual([{ url: 'ai/images/gpt-image-2/generated.png' }])
  })
})
