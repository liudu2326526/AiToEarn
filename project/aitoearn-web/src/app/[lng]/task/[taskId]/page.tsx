import TaskDetailPage from './TaskDetailPage'

interface PageProps {
  params: {
    taskId: string
  }
}

export default function Page({ params }: PageProps) {
  return <TaskDetailPage taskId={params.taskId} />
}
