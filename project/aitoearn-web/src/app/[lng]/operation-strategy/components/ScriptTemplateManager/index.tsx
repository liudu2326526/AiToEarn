'use client'

import type { ColumnsType } from 'antd/es/table'
import { Button, Drawer, Form, Input, Popconfirm, Select, Space, Switch, Table, message } from 'antd'
import { Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createScriptTemplate,
  deleteScriptTemplate,
  listScriptTemplates,
  updateScriptTemplate,
} from '@/api/operationStrategy'
import type {
  CreateScriptTemplatePayload,
  ScriptTemplate,
  ScriptTemplateScene,
} from '@/api/types/operationStrategy'
import { useTransClient } from '@/app/i18n/client'

const SCRIPT_SCENES: ScriptTemplateScene[] = [
  'comment_ask_price',
  'comment_ask_link',
  'comment_ask_size',
  'comment_praise',
  'comment_price_objection',
  'comment_negative',
  'private_message_first',
  'private_message_value',
  'private_message_wechat_guide',
]

const DEFAULT_PLATFORM_CONSTRAINTS = {
  allowWechatId: false,
  requireManualConfirm: false,
  blockedPlatforms: [],
}

function formatDate(value?: string) {
  if (!value)
    return '-'
  return new Date(value).toLocaleString()
}

export default function ScriptTemplateManager() {
  const { t } = useTransClient('route')
  const [rows, setRows] = useState<ScriptTemplate[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<{ scene?: ScriptTemplateScene; enabled?: boolean; keyword?: string }>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [active, setActive] = useState<ScriptTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<CreateScriptTemplatePayload>()

  const sceneOptions = useMemo(() => {
    return SCRIPT_SCENES.map(value => ({
      value,
      label: t(`operationStrategy.scenes.${value}`),
    }))
  }, [t])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listScriptTemplates({ page, pageSize, ...filters })
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
      scene: 'comment_praise',
      content: '',
      variables: [],
      enabled: true,
      applicableCategories: [],
      riskLevel: 'low',
      platformConstraints: DEFAULT_PLATFORM_CONSTRAINTS,
    })
    setDrawerOpen(true)
  }

  function openEdit(record: ScriptTemplate) {
    setActive(record)
    form.setFieldsValue({
      ...record,
      platformConstraints: record.platformConstraints || DEFAULT_PLATFORM_CONSTRAINTS,
    })
    setDrawerOpen(true)
  }

  async function submit() {
    setSaving(true)
    try {
      const values = await form.validateFields()
      const payload: CreateScriptTemplatePayload = {
        ...values,
        riskLevel: active?.riskLevel || values.riskLevel || 'low',
        platformConstraints: active?.platformConstraints || values.platformConstraints || DEFAULT_PLATFORM_CONSTRAINTS,
      }
      if (active)
        await updateScriptTemplate(active.id, payload)
      else
        await createScriptTemplate(payload)
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

  async function remove(record: ScriptTemplate) {
    try {
      await deleteScriptTemplate(record.id)
      message.success(t('operationStrategy.messages.deleted'))
      await load()
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : t('operationStrategy.messages.deleteFailed'))
    }
  }

  async function toggleEnabled(record: ScriptTemplate, enabled: boolean) {
    try {
      await updateScriptTemplate(record.id, { enabled })
      await load()
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : t('operationStrategy.messages.saveFailed'))
    }
  }

  const columns: ColumnsType<ScriptTemplate> = [
    {
      title: t('operationStrategy.columns.name'),
      dataIndex: 'name',
      width: 170,
      fixed: 'left',
    },
    {
      title: t('operationStrategy.columns.scene'),
      dataIndex: 'scene',
      width: 190,
      render: value => t(`operationStrategy.scenes.${value}`),
    },
    {
      title: t('operationStrategy.columns.content'),
      dataIndex: 'content',
      ellipsis: true,
    },
    {
      title: t('operationStrategy.columns.variables'),
      width: 180,
      render: (_, record) => record.variables.join(', ') || '-',
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
            style={{ width: 190 }}
            placeholder={t('operationStrategy.filters.scene')}
            options={sceneOptions}
            onChange={scene => updateFilters({ scene })}
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
        scroll={{ x: 1180 }}
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
        width={560}
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
          <Form.Item name="scene" label={t('operationStrategy.fields.replyStyle')} rules={[{ required: true, message: t('operationStrategy.validation.required') }]}>
            <Select options={sceneOptions} />
          </Form.Item>
          <Form.Item
            name="content"
            label={t('operationStrategy.fields.content')}
            rules={[
              { required: true, message: t('operationStrategy.validation.required') },
              { max: 1000, message: t('operationStrategy.validation.max1000') },
            ]}
          >
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item name="variables" label={t('operationStrategy.fields.variables')}>
            <Select mode="tags" />
          </Form.Item>
          <Form.Item name="enabled" label={t('operationStrategy.fields.enabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="applicableCategories" label={t('operationStrategy.fields.applicableCategories')}>
            <Select mode="tags" />
          </Form.Item>
        </Form>
      </Drawer>
    </Space>
  )
}
