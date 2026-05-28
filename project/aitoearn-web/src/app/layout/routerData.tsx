/**
 * 路由/导航数据配置
 * 包含导航项的图标、路径、翻译键等信息
 */
import {
  BarChart3,
  Bot,
  Database,
  History,
  Home,
  MessageSquareText,
  SlidersHorizontal,
  Upload,
  UsersRound,
} from 'lucide-react'

export interface IRouterDataItem {
  // 导航标题
  name: string
  // 翻译键
  translationKey: string
  // 跳转链接
  path?: string
  // 图标
  icon?: React.ReactNode
  // 子导航
  children?: IRouterDataItem[]
}

export const routerData: IRouterDataItem[] = [
  {
    name: 'Content Management',
    translationKey: 'header.draftBox',
    path: '/',
    icon: <Home size={20} />,
  },
  {
    name: 'Work Data',
    translationKey: 'acquisition.nav.workData',
    path: '/work-data',
    icon: <Database size={20} />,
  },
  {
    name: 'Lead Tracking',
    translationKey: 'acquisition.nav.leads',
    path: '/leads',
    icon: <MessageSquareText size={20} />,
  },
  {
    name: 'Operation Strategy',
    translationKey: 'acquisition.nav.strategy',
    path: '/operation-strategy',
    icon: <SlidersHorizontal size={20} />,
  },
  {
    name: 'Acquisition Dashboard',
    translationKey: 'acquisition.nav.dashboard',
    path: '/acquisition-dashboard',
    icon: <BarChart3 size={20} />,
  },
  {
    name: 'Task History',
    translationKey: 'tasksHistory',
    path: '/tasks-history',
    icon: <History size={20} />,
  },
  {
    name: 'Account Management',
    translationKey: 'accountManagement',
    path: '/account-management',
    icon: <UsersRound size={20} />,
  },
  // Tasks moved to notification panel
  {
    name: 'Agent Assets',
    translationKey: 'header.agentAssets',
    path: '/agent-assets',
    icon: <Bot size={20} />,
  },
  {
    name: 'Publish Calendar',
    translationKey: 'publishCalendar',
    path: '/accounts',
    icon: <Upload size={20} />,
  },
]

export const visibleRouterData = routerData
