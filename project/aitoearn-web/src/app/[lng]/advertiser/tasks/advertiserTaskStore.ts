import type { PromotionTask } from '@/api/types/promotion'
import { create } from 'zustand'

interface AdvertiserTaskState {
  tasks: PromotionTask[]
  setTasks: (tasks: PromotionTask[]) => void
}

export const useAdvertiserTaskStore = create<AdvertiserTaskState>(set => ({
  tasks: [],
  setTasks: tasks => set({ tasks }),
}))
