import { create } from 'zustand'
import {
  apiGenerateAcquisitionContent,
  apiListAcquisitionContent,
  apiReviewAcquisitionContent,
} from '@/api/acquisitionContent'
import type {
  AcquisitionContent,
  AcquisitionContentStatus,
  GenerateAcquisitionContentPayload,
} from '@/api/types/acquisitionContent'

interface ContentGenerationState {
  list: AcquisitionContent[]
  total: number
  loading: boolean
  selectedContent?: AcquisitionContent
  status?: AcquisitionContentStatus
  fetchList: () => Promise<void>
  generate: (payload: GenerateAcquisitionContentPayload) => Promise<AcquisitionContent>
  review: (id: string, action: 'approve' | 'reject', note?: string) => Promise<void>
  selectContent: (content?: AcquisitionContent) => void
}

export const useContentGenerationStore = create<ContentGenerationState>((set, get) => ({
  list: [],
  total: 0,
  loading: false,
  async fetchList() {
    set({ loading: true })
    try {
      const res = await apiListAcquisitionContent({ status: get().status, page: 1, pageSize: 20 })
      set({ list: res?.data?.list ?? [], total: res?.data?.total ?? 0 })
    }
    finally {
      set({ loading: false })
    }
  },
  async generate(payload) {
    set({ loading: true })
    try {
      const res = await apiGenerateAcquisitionContent(payload)
      if (!res?.data) throw new Error(res?.message || 'Generate acquisition content failed')
      await get().fetchList()
      return res.data
    }
    finally {
      set({ loading: false })
    }
  },
  async review(id, action, note) {
    await apiReviewAcquisitionContent(id, { action, note })
    await get().fetchList()
  },
  selectContent(content) {
    set({ selectedContent: content })
  },
}))
