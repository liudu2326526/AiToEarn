import type { PromotionTask } from '@/api/types/promotion'
import { create } from 'zustand'

interface TaskDetailState {
  task?: PromotionTask
  setTask: (task?: PromotionTask) => void
}

export const useTaskDetailStore = create<TaskDetailState>(set => ({
  task: undefined,
  setTask: task => set({ task }),
}))
