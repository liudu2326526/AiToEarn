import { create } from 'zustand'

export interface StrategyTemplateState {
  activeTab: 'hooks' | 'scripts' | 'accounts'
  setActiveTab: (activeTab: StrategyTemplateState['activeTab']) => void
}

export const useStrategyTemplateStore = create<StrategyTemplateState>(set => ({
  activeTab: 'hooks',
  setActiveTab(activeTab) {
    set({ activeTab })
  },
}))
