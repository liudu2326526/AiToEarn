'use client'

import { Button, Checkbox, Form, Input, Select } from 'antd'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useContentGenerationStore } from '../../useContentGenerationStore'

export function ContentGenerationForm() {
  const { t } = useTranslation('route')
  const [form] = Form.useForm()
  const generate = useContentGenerationStore(state => state.generate)
  const loading = useContentGenerationStore(state => state.loading)
  const platformOptions = [
    { value: 'xhs', label: t('acquisition.platform.xhs') },
    { value: 'douyin', label: t('acquisition.platform.douyin') },
    { value: 'kwai', label: t('acquisition.platform.kwai') },
  ]

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Form
        form={form}
        layout="vertical"
        initialValues={{ platforms: ['xhs'], autoAttachHook: true, generateMedia: false, mediaMode: 'image_text' }}
        onFinish={values => generate({ ...values, referenceImageUrls: values.referenceImageUrls || [] })}
      >
        <Form.Item name="platforms" label={t('acquisition.form.platforms')} rules={[{ required: true }]}>
          <Select mode="multiple" options={platformOptions} />
        </Form.Item>
        <Form.Item name="accountIds" label={t('acquisition.form.accountIds')} rules={[{ required: true }]}>
          <Select mode="tags" tokenSeparators={[',']} />
        </Form.Item>
        <Form.Item name="productName" label={t('acquisition.form.productName')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="productCategory" label={t('acquisition.form.productCategory')} rules={[{ required: true }]}>
          <Input placeholder={t('acquisition.form.productCategoryPlaceholder')} />
        </Form.Item>
        <Form.Item name="priceRange" label={t('acquisition.form.priceRange')}>
          <Input />
        </Form.Item>
        <Form.Item name="sizeRange" label={t('acquisition.form.sizeRange')}>
          <Input />
        </Form.Item>
        <Form.Item name="sellingPoints" label={t('acquisition.form.sellingPoints')} rules={[{ required: true }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item name="contentStyle" label={t('acquisition.form.contentStyle')}>
          <Input />
        </Form.Item>
        <Form.Item name="autoAttachHook" valuePropName="checked">
          <Checkbox>{t('acquisition.form.autoAttachHook')}</Checkbox>
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} icon={<Sparkles size={16} />}>
          {t('acquisition.actions.generate')}
        </Button>
      </Form>
    </div>
  )
}
