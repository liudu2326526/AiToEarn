'use client'

import type { AcquisitionContent, AcquisitionPlatform } from '@/api/types/acquisitionContent'
import { Button, DatePicker, Drawer, Form, Select } from 'antd'
import dayjs from 'dayjs'
import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiScheduleAcquisitionContent } from '@/api/acquisitionContent'

interface SchedulePublishDrawerProps {
  open: boolean
  content?: AcquisitionContent
  onClose: () => void
  onScheduled: () => void
}

export function SchedulePublishDrawer({ open, content, onClose, onScheduled }: SchedulePublishDrawerProps) {
  const { t } = useTranslation('route')
  const [form] = Form.useForm()

  async function submit(values: { publishAt: dayjs.Dayjs, accountMap: Record<AcquisitionPlatform, string> }) {
    if (!content) return
    const res = await apiScheduleAcquisitionContent(content.id, {
      publishAt: values.publishAt.toISOString(),
      accountMap: values.accountMap,
    })
    if (res?.data) onScheduled()
  }

  return (
    <Drawer open={open} width={420} title={t('acquisition.schedule.title')} onClose={onClose}>
      <Form form={form} layout="vertical" initialValues={{ publishAt: dayjs().add(1, 'hour') }} onFinish={submit}>
        <Form.Item name="publishAt" label={t('acquisition.schedule.publishAt')} rules={[{ required: true }]}>
          <DatePicker showTime className="w-full" />
        </Form.Item>
        {content?.targetPlatforms.map(platform => (
          <Form.Item key={platform} name={['accountMap', platform]} label={t('acquisition.schedule.accountForPlatform', { platform })} rules={[{ required: true }]}>
            <Select mode="tags" tokenSeparators={[',']} />
          </Form.Item>
        ))}
        <Button type="primary" htmlType="submit" icon={<CalendarClock size={16} />}>
          {t('acquisition.actions.schedule')}
        </Button>
      </Form>
    </Drawer>
  )
}
