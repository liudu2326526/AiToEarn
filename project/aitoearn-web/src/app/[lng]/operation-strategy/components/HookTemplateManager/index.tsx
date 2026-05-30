'use client'

import type { ColumnsType } from 'antd/es/table'
import { Button, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd'
import { Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createHookTemplate,
  deleteHookTemplate,
  listHookTemplates,
  updateHookTemplate,
} from '@/api/operationStrategy'
import type { AcquisitionPlatform } from '@/api/types/acquisitionContent'
import type {
  CreateHookTemplatePayload,
  HookTemplate,
  HookTemplateCategory,
} from '@/api/types/operationStrategy'
import { useTransClient } from '@/app/i18n/client'

const HOOK_CATEGORIES: HookTemplateCategory[] = [
  'follow_guide',
  'private_message_guide',
  'profile_guide',
  'benefit_guide',
  'stock_urgency',
  'size_consulting',
  'wechat_guide',
]

const PLATFORM_OPTIONS: AcquisitionPlatform[] = ['xhs', 'douyin', 'kwai']

function formatDate(value?: string) {
  if (!value)
    return '-'
  return new Date(value).toLocaleString()
}

export default function HookTemplateManager() {
  const { t } = useTransClient('route')
  const [rows, setRows] = useState<HookTemplate[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<{ category?: HookTemplateCategory; enabled?: boolean; keyword?: string }>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [active, setActive] = useState<HookTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<CreateHookTemplatePayload>()

  const categoryOptions = useMemo(() => {
    return HOOK_CATEGORIES.map(value => ({
      value,
      label: t(`operationStrategy.hookCategories.${value}`),
    }))
  }, [t])

  const platformOptions = useMemo(() => {
    return PLATFORM_OPTIONS.map(value => ({
      value,
      label: t(`acquisition.platform.${value}`),
    }))
  }, [t])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listHookTemplates({ page, pageSize, ...filters })
      setRows(data.list)
      setTotal(data.total)
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : t('operationStrategy.messages.loadFailed'))
    }
    finally {
      setLoading(false)
    }
  }, [filters, page, pageSize, t])

  useEffect(() => {
    void load()
  }, [load])

  function updateFilters(next: Partial<typeof filters>) {
    setFilters(prev => ({ ...prev, ...next }))
    setPage(1)
  }

  function openCreate() {
    setActive(null)
    form.setFieldsValue({
      name: '',
      category: 'follow_guide',
      content: '',
      weight: 1,
      enabled: true,
      applicablePlatforms: [],
      applicableCategories: [],
      applicableAccountIds: [],
    })
    setDrawerOpen(true)
  }

  function openEdit(record: HookTemplate) {
    setActive(record)
    form.setFieldsValue(record)
    setDrawerOpen(true)
  }

  async function submit() {
    setSaving(true)
    try {
      const values = await form.validateFields()
      if (active)
        await updateHookTemplate(active.id, values)
      else
        await createHookTemplate(values)
      message.success(t('operationStrategy.messages.saved'))
      setDrawerOpen(false)
      await load()
    }
    catch (error) {
      if (error instanceof Error)
        message.error(error.message)
    }
    finally {
      setSaving(false)
    }
  }

  async function remove(record: HookTemplate) {
    try {
      await deleteHookTemplate(record.id)
      message.success(t('operationStrategy.messages.deleted'))
      await load()
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : t('operationStrategy.messages.deleteFailed'))
    }
  }

  async function toggleEnabled(record: HookTemplate, enabled: boolean) {
    try {
      await updateHookTemplate(record.id, { enabled })
      await load()
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : t('operationStrategy.messages.saveFailed'))
    }
  }

  const columns: ColumnsType<HookTemplate> = [
    {
      title: t('operationStrategy.columns.name'),
      dataIndex: 'name',
      width: 170,
      fixed: 'left',
    },
    {
      title: t('operationStrategy.columns.category'),
      dataIndex: 'category',
      width: 150,
      render: value => t(`operationStrategy.hookCategories.${value}`),
    },
    {
      title: t('operationStrategy.columns.content'),
      dataIndex: 'content',
      ellipsis: true,
    },
    {
      title: t('operationStrategy.columns.scope'),
      width: 230,
      render: (_, record) => (
        <Space size={[4, 4]} wrap>
          <Tag>{record.applicablePlatforms.length ? record.applicablePlatforms.join(', ') : t('operationStrategy.scope.allPlatforms')}</Tag>
          <Tag>{record.applicableCategories.length ? record.applicableCategories.join(', ') : t('operationStrategy.scope.allCategories')}</Tag>
        </Space>
      ),
    },
    {
      title: t('operationStrategy.columns.weight'),
      dataIndex: 'weight',
      width: 90,
    },
    {
      title: t('operationStrategy.columns.enabled'),
      width: 120,
      render: (_, record) => (
        <Switch
          checked={record.enabled}
          checkedChildren={t('operationStrategy.status.enabled')}
          unCheckedChildren={t('operationStrategy.status.disabled')}
          onChange={checked => toggleEnabled(record, checked)}
        />
      ),
    },
    {
      title: t('operationStrategy.columns.updatedAt'),
      dataIndex: 'updatedAt',
      width: 190,
      render: formatDate,
    },
    {
      title: t('operationStrategy.columns.actions'),
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEdit(record)}>
            {t('operationStrategy.actions.edit')}
          </Button>
          <Popconfirm title={t('operationStrategy.confirm.delete')} onConfirm={() => remove(record)}>
            <Button type="link" danger>
              {t('operationStrategy.actions.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Space wrap>
          <Select
            allowClear
            style={{ width: 170 }}
            placeholder={t('operationStrategy.filters.category')}
            options={categoryOptions}
            onChange={category => updateFilters({ category })}
          />
          <Select
            allowClear
            style={{ width: 150 }}
            placeholder={t('operationStrategy.filters.enabled')}
            options={[
              { value: true, label: t('operationStrategy.status.enabled') },
              { value: false, label: t('operationStrategy.status.disabled') },
            ]}
            onChange={enabled => updateFilters({ enabled })}
          />
          <Input.Search
            allowClear
            style={{ width: 240 }}
            placeholder={t('operationStrategy.filters.keyword')}
            onSearch={keyword => updateFilters({ keyword: keyword || undefined })}
          />
        </Space>
        <Space>
          <Button icon={<RefreshCw size={15} />} onClick={load}>
            {t('operationStrategy.actions.refresh')}
          </Button>
          <Button type="primary" icon={<Plus size={15} />} onClick={openCreate}>
            {t('operationStrategy.actions.create')}
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1120 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage)
            setPageSize(nextPageSize)
          },
        }}
      />

      <Drawer
        width={520}
        title={active ? t('operationStrategy.actions.edit') : t('operationStrategy.actions.create')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={(
          <Button type="primary" loading={saving} onClick={submit}>
            {t('operationStrategy.actions.save')}
          </Button>
        )}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="name" label={t('operationStrategy.fields.name')} rules={[{ required: true, message: t('operationStrategy.validation.required') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label={t('operationStrategy.fields.category')} rules={[{ required: true, message: t('operationStrategy.validation.required') }]}>
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item
            name="content"
            label={t('operationStrategy.fields.content')}
            rules={[
              { required: true, message: t('operationStrategy.validation.required') },
              { max: 500, message: t('operationStrategy.validation.max500') },
            ]}
          >
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item name="weight" label={t('operationStrategy.fields.weight')}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label={t('operationStrategy.fields.enabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="applicablePlatforms" label={t('operationStrategy.fields.applicablePlatforms')}>
            <Select mode="multiple" options={platformOptions} />
          </Form.Item>
          <Form.Item name="applicableCategories" label={t('operationStrategy.fields.applicableCategories')}>
            <Select mode="tags" />
          </Form.Item>
          <Form.Item name="applicableAccountIds" label={t('operationStrategy.fields.applicableAccountIds')}>
            <Select mode="tags" />
          </Form.Item>
        </Form>
      </Drawer>
    </Space>
  )
}
