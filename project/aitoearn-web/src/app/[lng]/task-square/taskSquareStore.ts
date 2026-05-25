import type { PromotionTask, PromotionTaskListParams } from '@/api/types/promotion'
import { create } from 'zustand'

interface TaskSquareState {
  filters: PromotionTaskListParams
  tasks: PromotionTask[]
  setFilters: (filters: PromotionTaskListParams) => void
  setTasks: (tasks: PromotionTask[]) => void
}

export const useTaskSquareStore = create<TaskSquareState>(set => ({
  filters: { page: 1, pageSize: 30 },
  tasks: [],
  setFilters: filters => set({ filters }),
  setTasks: tasks => set({ tasks }),
}))
