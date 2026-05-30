'use client'

import type { ColumnsType } from 'antd/es/table'
import { Avatar, Button, Drawer, Form, Input, InputNumber, Select, Space, Switch, Table, message } from 'antd'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listAccountOpsConfigs,
  upsertAccountOpsConfig,
} from '@/api/operationStrategy'
import type {
  AccountOpsConfig,
  AccountOpsConfigRow,
  ReplyTone,
  UpsertAccountOpsConfigPayload,
} from '@/api/types/operationStrategy'
import { useTransClient } from '@/app/i18n/client'
import StrategyStatusTag from '../StrategyStatusTag'

const REPLY_TONES: ReplyTone[] = ['friendly', 'professional', 'promotion', 'restrained']

const defaultConfig: UpsertAccountOpsConfigPayload = {
  dailyPublishLimit: 10,
  dailyInteractionLimit: 50,
  dailyCommentFetchLimit: 20,
  dailyWechatGuideLimit: 10,
  defaultWechatId: '',
  defaultScriptStrategy: '',
  replyTone: 'friendly',
  enableAutoGenerate: true,
  enableCommentFetch: true,
  blockPublicContactInfo: true,
  sensitiveWords: [],
}

function mergedConfig(config: AccountOpsConfig | null | undefined): UpsertAccountOpsConfigPayload {
  return {
    ...defaultConfig,
    dailyPublishLimit: config?.dailyPublishLimit ?? defaultConfig.dailyPublishLimit,
    dailyInteractionLimit: config?.dailyInteractionLimit ?? defaultConfig.dailyInteractionLimit,
    dailyCommentFetchLimit: config?.dailyCommentFetchLimit ?? defaultConfig.dailyCommentFetchLimit,
    dailyWechatGuideLimit: config?.dailyWechatGuideLimit ?? defaultConfig.dailyWechatGuideLimit,
    defaultWechatId: config?.defaultWechatId ?? defaultConfig.defaultWechatId,
    defaultScriptStrategy: config?.defaultScriptStrategy ?? defaultConfig.defaultScriptStrategy,
    replyTone: config?.replyTone ?? defaultConfig.replyTone,
    enableAutoGenerate: config?.enableAutoGenerate ?? defaultConfig.enableAutoGenerate,
    enableCommentFetch: config?.enableCommentFetch ?? defaultConfig.enableCommentFetch,
    blockPublicContactInfo: config?.blockPublicContactInfo ?? defaultConfig.blockPublicContactInfo,
    sensitiveWords: config?.sensitiveWords ?? defaultConfig.sensitiveWords,
  }
}

function capabilityColor(status?: string) {
  if (status === 'ready')
    return 'success'
  if (status === 'permission_required' || status === 'pending_authorization' || status === 'pending_confirmation' || status === 'manual_required')
    return 'warning'
  if (status === 'failed')
    return 'error'
  return 'default'
}

export default function AccountOpsConfigManager() {
  const { t } = useTransClient('route')
  const [rows, setRows] = useState<AccountOpsConfigRow[]>([])
  const [active, setActive] = useState<AccountOpsConfigRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<UpsertAccountOpsConfigPayload>()

  const toneOptions = useMemo(() => {
    return REPLY_TONES.map(value => ({
      value,
      label: t(`operationStrategy.tone.${value}`),
    }))
  }, [t])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAccountOpsConfigs()
      setRows(data.list)
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : t('operationStrategy.messages.loadFailed'))
    }
    finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  function openEdit(row: AccountOpsConfigRow) {
    setActive(row)
    form.setFieldsValue(mergedConfig(row.config))
    setDrawerOpen(true)
  }

  async function submit() {
    if (!active)
      return
    setSaving(true)
    try {
      const values = await form.validateFields()
      await upsertAccountOpsConfig(active.accountId, values)
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

  const columns: ColumnsType<AccountOpsConfigRow> = [
    {
      title: t('operationStrategy.columns.platform'),
      dataIndex: 'platform',
      width: 120,
      render: value => t(`acquisition.platform.${value}`, { defaultValue: value }),
    },
    {
      title: t('operationStrategy.columns.account'),
      width: 240,
      render: (_, row) => (
        <Space>
          <Avatar src={row.avatar}>{(row.nickname || row.accountId).slice(0, 1).toUpperCase()}</Avatar>
          <span>{row.nickname || row.accountId}</span>
        </Space>
      ),
    },
    {
      title: t('operationStrategy.columns.dailyPublishLimit'),
      width: 120,
      render: (_, row) => mergedConfig(row.config).dailyPublishLimit,
    },
    {
      title: t('operationStrategy.columns.dailyInteractionLimit'),
      width: 120,
      render: (_, row) => mergedConfig(row.config).dailyInteractionLimit,
    },
    {
      title: t('operationStrategy.columns.dailyCommentFetchLimit'),
      width: 140,
      render: (_, row) => mergedConfig(row.config).dailyCommentFetchLimit,
    },
    {
      title: t('operationStrategy.columns.dailyWechatGuideLimit'),
      width: 130,
      render: (_, row) => mergedConfig(row.config).dailyWechatGuideLimit,
    },
    {
      title: t('operationStrategy.columns.replyTone'),
      width: 120,
      render: (_, row) => t(`operationStrategy.tone.${mergedConfig(row.config).replyTone}`),
    },
    {
      title: t('operationStrategy.columns.commentFetchStatus'),
      width: 150,
      render: (_, row) => {
        const status = row.config?.commentFetchStatus || 'not_configured'
        return (
          <StrategyStatusTag color={capabilityColor(status)}>
            {t(`operationStrategy.capability.${status}`, { defaultValue: status })}
          </StrategyStatusTag>
        )
      },
    },
    {
      title: t('operationStrategy.columns.actions'),
      width: 100,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" onClick={() => openEdit(row)}>
          {t('operationStrategy.actions.edit')}
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div className="flex justify-end">
        <Button icon={<RefreshCw size={15} />} onClick={load}>
          {t('operationStrategy.actions.refresh')}
        </Button>
      </div>

      <Table
        rowKey="accountId"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1320 }}
      />

      <Drawer
        width={520}
        title={t('operationStrategy.tabs.accounts')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={(
          <Button type="primary" loading={saving} onClick={submit}>
            {t('operationStrategy.actions.save')}
          </Button>
        )}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="dailyPublishLimit" label={t('operationStrategy.columns.dailyPublishLimit')}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="dailyInteractionLimit" label={t('operationStrategy.columns.dailyInteractionLimit')}>
            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="dailyCommentFetchLimit" label={t('operationStrategy.columns.dailyCommentFetchLimit')}>
            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="dailyWechatGuideLimit" label={t('operationStrategy.columns.dailyWechatGuideLimit')}>
            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="defaultWechatId" label={t('operationStrategy.fields.defaultWechatId')}>
            <Input />
          </Form.Item>
          <Form.Item name="defaultScriptStrategy" label={t('operationStrategy.fields.defaultScriptStrategy')}>
            <Input />
          </Form.Item>
          <Form.Item name="replyTone" label={t('operationStrategy.columns.replyTone')}>
            <Select options={toneOptions} />
          </Form.Item>
          <Form.Item name="enableAutoGenerate" label={t('operationStrategy.fields.enableAutoGenerate')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enableCommentFetch" label={t('operationStrategy.fields.enableCommentFetch')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="blockPublicContactInfo" label={t('operationStrategy.fields.blockPublicContactInfo')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sensitiveWords" label={t('operationStrategy.fields.sensitiveWords')}>
            <Select mode="tags" />
          </Form.Item>
        </Form>
      </Drawer>
    </Space>
  )
}
