import React, { useEffect, useState } from 'react'
import { Modal, Form, Select, Input, message } from 'antd'
import { useTransClient } from '@/app/i18n/client'
import { useParams } from 'next/navigation'
import { getAccountListApi } from '@/api/account'
import { createMonitoredPost } from '@/api/workData'
import type { SocialAccount } from '@/api/types/account.type'
import type { AcquisitionPlatform } from '@/api/acquisition'

interface AddMonitoredPostDialogProps {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
}

const AddMonitoredPostDialog: React.FC<AddMonitoredPostDialogProps> = ({ visible, onCancel, onSuccess }) => {
  const { lng } = useParams()
  const { t } = useTransClient('route')
  const [form] = Form.useForm()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      getAccountListApi().then((res) => {
        if (res && res.data) {
          setAccounts(res.data)
        }
      })
    }
  }, [visible])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      await createMonitoredPost({
        platform: values.platform,
        accountId: values.accountId,
        postUrl: values.postUrl,
        postId: values.postId,
      })
      message.success(t('workData.addSuccess'))
      onSuccess()
      form.resetFields()
    } catch (error: any) {
      message.error(error.message || t('workData.addFailed'))
    } finally {
      setLoading(false)
    }
  }

  const platforms: AcquisitionPlatform[] = ['xhs', 'douyin', 'kwai']

  return (
    <Modal
      title={t('workData.addTitle')}
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="platform"
          label={t('workData.platform')}
          rules={[{ required: true, message: t('workData.validation.platformRequired') }]}
        >
          <Select placeholder={t('workData.selectPlatform')}>
            {platforms.map((p) => (
              <Select.Option key={p} value={p}>
                {t(`acquisition.platform.${p}`)}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.platform !== currentValues.platform}
        >
          {({ getFieldValue }) => {
            const platform = getFieldValue('platform')
            const filteredAccounts = accounts.filter((a) => a.type === platform)
            return (
              <Form.Item
                name="accountId"
                label={t('workData.account')}
                rules={[{ required: true, message: t('workData.validation.accountRequired') }]}
              >
                <Select placeholder={t('workData.selectAccount')} disabled={!platform}>
                  {filteredAccounts.map((a) => (
                    <Select.Option key={a.id} value={a.id}>
                      {a.nickname} ({a.account})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            )
          }}
        </Form.Item>

        <Form.Item
          name="postUrl"
          label={t('workData.postUrl')}
          rules={[
            { required: true, message: t('workData.validation.postUrlRequired') },
            { type: 'url', message: t('workData.validation.postUrlInvalid') },
          ]}
        >
          <Input placeholder="https://..." />
        </Form.Item>

        <Form.Item
          name="postId"
          label={t('workData.postId')}
          tooltip={t('workData.postIdTooltip')}
        >
          <Input placeholder={t('workData.postIdPlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default AddMonitoredPostDialog
