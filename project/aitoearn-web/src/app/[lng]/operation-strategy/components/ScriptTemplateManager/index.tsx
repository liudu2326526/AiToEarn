'use client'

import type { ColumnsType } from 'antd/es/table'
import type { CSSProperties } from 'react'
import { Button, Form, Input, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createScriptTemplate,
  listScriptTemplates,
  updateScriptTemplate,
} from '@/api/operationStrategy'
import type {
  CreateScriptTemplatePayload,
  ScriptTemplate,
  ScriptTemplateScene,
} from '@/api/types/operationStrategy'
import { useTransClient } from '@/app/i18n/client'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

const { Text } = Typography

type ReplyStyle = Extract<ScriptTemplateScene, 'friendly' | 'professional' | 'promotion' | 'restrained'>
type ReplyStyleSubtab = 'style-prompts' | 'auto-classifier'

const SCRIPT_STYLES: ReplyStyle[] = ['friendly', 'professional', 'promotion', 'restrained']
const AUTO_CLASSIFIER_SCENE: Extract<ScriptTemplateScene, 'reply_style_classifier'> = 'reply_style_classifier'

const STYLE_TAG_COLOR: Record<ReplyStyle, string> = {
  friendly: 'blue',
  professional: 'green',
  promotion: 'gold',
  restrained: 'default',
}

const PILL_BUTTON_STYLE: CSSProperties = {
  height: 40,
  borderRadius: 999,
  borderColor: '#d8e1ec',
  background: 'rgba(248, 250, 252, 0.82)',
  color: '#334155',
  boxShadow: '0 6px 16px rgba(15, 23, 42, 0.04)',
  fontWeight: 600,
  paddingInline: 16,
}

const SOFT_BLUE_BUTTON_STYLE: CSSProperties = {
  ...PILL_BUTTON_STYLE,
  borderColor: '#9bd7ff',
  background: 'rgba(239, 248, 255, 0.9)',
  color: '#1677ff',
}

const SOFT_BLUE_TAG_STYLE: CSSProperties = {
  width: 'fit-content',
  marginInlineEnd: 0,
  borderRadius: 6,
  fontWeight: 600,
}

const CONFIG_PANEL_STYLE: CSSProperties = {
  borderRadius: 8,
  border: '1px solid #e8edf5',
  background: '#ffffff',
  padding: 16,
}

const SETTING_TILE_STYLE: CSSProperties = {
  minHeight: 74,
  borderRadius: 8,
  border: '1px solid #e8edf5',
  background: '#fafafa',
  padding: '12px 14px',
}

const SETTING_TILE_CONTENT_STYLE: CSSProperties = {
  display: 'flex',
  height: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
}

const STATUS_TAG_STYLE: CSSProperties = {
  width: 'fit-content',
  marginInlineEnd: 0,
  borderRadius: 999,
  fontSize: 12,
  lineHeight: '20px',
  paddingInline: 8,
}

const TEXTAREA_STYLE: CSSProperties = {
  resize: 'none',
  lineHeight: 1.65,
  borderRadius: 8,
  background: '#ffffff',
}

const SECTION_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  padding: '2px 0 0',
}

const SECTION_ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
}

const INLINE_ACTION_BUTTON_STYLE: CSSProperties = {
  minWidth: 64,
  fontWeight: 600,
}

const DEFAULT_PLATFORM_CONSTRAINTS = {
  allowWechatId: false,
  requireManualConfirm: true,
  blockedPlatforms: [],
}

const DEFAULT_DRAFT = {
  content: '',
  enabled: true,
}

const DEFAULT_AUTO_CLASSIFIER_PROMPT = [
  '你是评论线索的回复风格判定机器人。',
  '请根据用户评论在 friendly、professional、promotion、restrained 中选择一种回复风格。',
  'promotion 用于求链接、怎么买、同款、价格、下单等转化意图；professional 用于尺码、材质、版型、参数、使用建议等咨询；restrained 用于负面、质疑、价格异议、外貌/年龄调侃或需要降温的评论；friendly 用于普通互动、赞同、玩笑和轻松问候。',
  '只输出风格枚举值，不输出解释。',
].join('\n')

const DEFAULT_AUTO_CLASSIFIER_DRAFT = {
  content: DEFAULT_AUTO_CLASSIFIER_PROMPT,
  enabled: true,
  blockPublicContactInfo: true,
  requireManualConfirm: false,
}

interface StylePromptRow {
  style: ReplyStyle
  template?: ScriptTemplate
}

interface ScriptTemplateManagerProps {
  mode?: ReplyStyleSubtab
}

function formatDate(value?: string) {
  if (!value)
    return '-'
  return new Date(value).toLocaleString()
}

function StatusTag({
  enabled,
  enabledLabel,
  disabledLabel,
}: {
  enabled: boolean
  enabledLabel: string
  disabledLabel: string
}) {
  return (
    <Tag color={enabled ? 'blue' : 'default'} style={STATUS_TAG_STYLE}>
      {enabled ? enabledLabel : disabledLabel}
    </Tag>
  )
}

function SettingSwitchTile({
  title,
  checked,
  enabledLabel,
  disabledLabel,
  onChange,
}: {
  title: string
  checked: boolean
  enabledLabel: string
  disabledLabel: string
  onChange: (checked: boolean) => void
}) {
  return (
    <div style={SETTING_TILE_STYLE}>
      <div style={SETTING_TILE_CONTENT_STYLE}>
        <Space direction="vertical" size={4}>
          <Text strong>{title}</Text>
          <StatusTag enabled={checked} enabledLabel={enabledLabel} disabledLabel={disabledLabel} />
        </Space>
        <Switch checked={checked} onChange={onChange} />
      </div>
    </div>
  )
}

export default function ScriptTemplateManager({ mode = 'style-prompts' }: ScriptTemplateManagerProps) {
  const { t } = useTransClient('route')
  const [templates, setTemplates] = useState<Record<ReplyStyle, ScriptTemplate | undefined>>({} as Record<ReplyStyle, ScriptTemplate | undefined>)
  const [drafts, setDrafts] = useState<Record<ReplyStyle, { content: string; enabled: boolean }>>({} as Record<ReplyStyle, { content: string; enabled: boolean }>)
  const [autoClassifierTemplate, setAutoClassifierTemplate] = useState<ScriptTemplate | undefined>()
  const [autoClassifierDraft, setAutoClassifierDraft] = useState(DEFAULT_AUTO_CLASSIFIER_DRAFT)
  const [activeStyle, setActiveStyle] = useState<ReplyStyle | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingStyle, setSavingStyle] = useState<ReplyStyle | null>(null)
  const [savingAutoClassifier, setSavingAutoClassifier] = useState(false)
  const [form] = Form.useForm<{ content: string; enabled: boolean }>()

  const styleLabels = useMemo<Record<ReplyStyle, string>>(() => ({
    friendly: t('operationStrategy.tone.friendly'),
    professional: t('operationStrategy.tone.professional'),
    promotion: t('operationStrategy.tone.promotion'),
    restrained: t('operationStrategy.tone.restrained'),
  }), [t])

  const rows = useMemo<StylePromptRow[]>(() => {
    return SCRIPT_STYLES.map(style => ({ style, template: templates[style] }))
  }, [templates])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listScriptTemplates({ page: 1, pageSize: 100 })
      const nextTemplates = {} as Record<ReplyStyle, ScriptTemplate | undefined>
      const nextDrafts = {} as Record<ReplyStyle, { content: string; enabled: boolean }>

      for (const style of SCRIPT_STYLES) {
        const template = data.list.find(item => item.scene === style)
        nextTemplates[style] = template
        nextDrafts[style] = template
          ? { content: template.content || '', enabled: template.enabled }
          : { ...DEFAULT_DRAFT }
      }

      const classifierTemplate = data.list.find(item => item.scene === AUTO_CLASSIFIER_SCENE)
      setAutoClassifierTemplate(classifierTemplate)
      setAutoClassifierDraft(classifierTemplate
        ? {
            content: classifierTemplate.content || DEFAULT_AUTO_CLASSIFIER_PROMPT,
            enabled: classifierTemplate.enabled,
            blockPublicContactInfo: !classifierTemplate.platformConstraints?.allowWechatId,
            requireManualConfirm: Boolean(classifierTemplate.platformConstraints?.requireManualConfirm),
          }
        : { ...DEFAULT_AUTO_CLASSIFIER_DRAFT })

      setTemplates(nextTemplates)
      setDrafts(nextDrafts)
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

  const activeTemplate = activeStyle ? templates[activeStyle] : undefined

  function updateDraft(style: ReplyStyle, next: Partial<{ content: string; enabled: boolean }>) {
    setDrafts(prev => ({
      ...prev,
      [style]: {
        ...(prev[style] || DEFAULT_DRAFT),
        ...next,
      },
    }))
  }

  function openEdit(style: ReplyStyle) {
    const draft = drafts[style] || DEFAULT_DRAFT
    setActiveStyle(style)
    form.setFieldsValue(draft)
    setEditorOpen(true)
  }

  async function saveStyle(style: ReplyStyle, values?: { content: string; enabled: boolean }) {
    const draft = values || drafts[style] || DEFAULT_DRAFT
    setSavingStyle(style)
    try {
      const payload: CreateScriptTemplatePayload = {
        name: t(`operationStrategy.stylePrompts.${style}.name`),
        scene: style,
        content: draft.content.trim(),
        variables: [],
        enabled: draft.enabled,
        applicableCategories: [],
        riskLevel: 'low',
        platformConstraints: DEFAULT_PLATFORM_CONSTRAINTS,
      }
      const existing = templates[style]
      if (existing)
        await updateScriptTemplate(existing.id, payload)
      else
        await createScriptTemplate(payload)

      message.success(t('operationStrategy.messages.saved'))
      await load()
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : t('operationStrategy.messages.saveFailed'))
    }
    finally {
      setSavingStyle(null)
    }
  }

  function updateAutoClassifierDraft(next: Partial<typeof DEFAULT_AUTO_CLASSIFIER_DRAFT>) {
    setAutoClassifierDraft(prev => ({
      ...prev,
      ...next,
    }))
  }

  async function saveAutoClassifier() {
    const content = autoClassifierDraft.content.trim()
    if (!content) {
      message.error(t('operationStrategy.validation.required'))
      return
    }

    setSavingAutoClassifier(true)
    try {
      const payload: CreateScriptTemplatePayload = {
        name: t('operationStrategy.autoStyleClassifier.name'),
        scene: AUTO_CLASSIFIER_SCENE,
        content,
        variables: [],
        enabled: autoClassifierDraft.enabled,
        applicableCategories: [],
        riskLevel: 'low',
        platformConstraints: {
          allowWechatId: !autoClassifierDraft.blockPublicContactInfo,
          requireManualConfirm: autoClassifierDraft.requireManualConfirm,
          blockedPlatforms: [],
        },
      }

      if (autoClassifierTemplate)
        await updateScriptTemplate(autoClassifierTemplate.id, payload)
      else
        await createScriptTemplate(payload)

      message.success(t('operationStrategy.messages.saved'))
      await load()
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : t('operationStrategy.messages.saveFailed'))
    }
    finally {
      setSavingAutoClassifier(false)
    }
  }

  async function submitActiveStyle() {
    if (!activeStyle)
      return

    const values = await form.validateFields()
    await saveStyle(activeStyle, values)
    setEditorOpen(false)
  }

  function closeEditor() {
    setEditorOpen(false)
  }

  async function toggleEnabled(style: ReplyStyle, enabled: boolean) {
    updateDraft(style, { enabled })
    const template = templates[style]
    if (!template)
      return

    setSavingStyle(style)
    try {
      await updateScriptTemplate(template.id, { enabled })
      await load()
    }
    catch (error) {
      message.error(error instanceof Error ? error.message : t('operationStrategy.messages.saveFailed'))
    }
    finally {
      setSavingStyle(null)
    }
  }

  const columns: ColumnsType<StylePromptRow> = [
    {
      title: t('operationStrategy.columns.scene'),
      dataIndex: 'style',
      width: 230,
      render: (style: ReplyStyle) => (
        <Space direction="vertical" size={4}>
          <Tag color={STYLE_TAG_COLOR[style]} style={SOFT_BLUE_TAG_STYLE}>
            {styleLabels[style]}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {t(`operationStrategy.stylePrompts.${style}.description`)}
          </Text>
        </Space>
      ),
    },
    {
      title: t('operationStrategy.columns.enabled'),
      width: 120,
      render: (_, record) => {
        const draft = drafts[record.style] || DEFAULT_DRAFT
        if (!record.template)
          return <Tag>{t('operationStrategy.capability.not_configured')}</Tag>

        return (
          <Switch
            checked={draft.enabled}
            loading={savingStyle === record.style}
            onChange={enabled => toggleEnabled(record.style, enabled)}
          />
        )
      },
    },
    {
      title: t('operationStrategy.fields.content'),
      dataIndex: 'content',
      ellipsis: true,
      render: (_, record) => {
        const draft = drafts[record.style] || DEFAULT_DRAFT
        return (
          <Text type={draft.content ? undefined : 'secondary'} ellipsis>
            {draft.content || t(`operationStrategy.stylePrompts.${record.style}.placeholder`)}
          </Text>
        )
      },
    },
    {
      title: t('operationStrategy.columns.updatedAt'),
      width: 190,
      render: (_, record) => formatDate(record.template?.updatedAt),
    },
    {
      title: t('operationStrategy.columns.actions'),
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Button
          autoInsertSpace={false}
          type={record.template ? 'default' : 'primary'}
          size="small"
          style={INLINE_ACTION_BUTTON_STYLE}
          loading={savingStyle === record.style}
          onClick={() => openEdit(record.style)}
        >
          <span>{t(record.template ? 'operationStrategy.actions.edit' : 'operationStrategy.actions.create')}</span>
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {mode === 'style-prompts' && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={SECTION_HEADER_STYLE}>
            <div>
              <Text strong>{t('operationStrategy.stylePrompts.title')}</Text>
              <div>
                <Text type="secondary">{t('operationStrategy.stylePrompts.description')}</Text>
              </div>
            </div>
            <Button autoInsertSpace={false} style={PILL_BUTTON_STYLE} icon={<RefreshCw size={15} />} loading={loading} onClick={load}>
              <span>{t('operationStrategy.actions.refresh')}</span>
            </Button>
          </div>

          <Table
            rowKey="style"
            loading={loading}
            columns={columns}
            dataSource={rows}
            size="middle"
            tableLayout="fixed"
            pagination={false}
            scroll={{ x: 1040 }}
          />
        </Space>
      )}

      {mode === 'auto-classifier' && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={SECTION_HEADER_STYLE}>
            <div>
              <Text strong>{t('operationStrategy.autoStyleClassifier.title')}</Text>
              <div>
                <Text type="secondary">{t('operationStrategy.autoStyleClassifier.description')}</Text>
              </div>
            </div>
            <div style={SECTION_ACTIONS_STYLE}>
              <Button autoInsertSpace={false} style={PILL_BUTTON_STYLE} icon={<RefreshCw size={15} />} loading={loading} onClick={load}>
                <span>{t('operationStrategy.actions.refresh')}</span>
              </Button>
              <Button autoInsertSpace={false} type="primary" loading={savingAutoClassifier} onClick={saveAutoClassifier}>
                <span>{t('operationStrategy.actions.save')}</span>
              </Button>
            </div>
          </div>

          <div style={CONFIG_PANEL_STYLE}>
            <Form layout="vertical">
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <SettingSwitchTile
                  title={t('operationStrategy.fields.enabled')}
                  checked={autoClassifierDraft.enabled}
                  enabledLabel={t('operationStrategy.status.enabled')}
                  disabledLabel={t('operationStrategy.status.disabled')}
                  onChange={enabled => updateAutoClassifierDraft({ enabled })}
                />
                <SettingSwitchTile
                  title={t('operationStrategy.autoStyleClassifier.blockPublicContactInfo')}
                  checked={autoClassifierDraft.blockPublicContactInfo}
                  enabledLabel={t('operationStrategy.status.enabled')}
                  disabledLabel={t('operationStrategy.status.disabled')}
                  onChange={blockPublicContactInfo => updateAutoClassifierDraft({ blockPublicContactInfo })}
                />
                <SettingSwitchTile
                  title={t('operationStrategy.autoStyleClassifier.requireManualConfirm')}
                  checked={autoClassifierDraft.requireManualConfirm}
                  enabledLabel={t('operationStrategy.status.enabled')}
                  disabledLabel={t('operationStrategy.status.disabled')}
                  onChange={requireManualConfirm => updateAutoClassifierDraft({ requireManualConfirm })}
                />
              </div>

              <Form.Item
                label={t('operationStrategy.autoStyleClassifier.prompt')}
                style={{ marginBottom: 0 }}
                required
              >
                <Input.TextArea
                  rows={10}
                  maxLength={1000}
                  showCount
                  value={autoClassifierDraft.content}
                  placeholder={DEFAULT_AUTO_CLASSIFIER_PROMPT}
                  style={TEXTAREA_STYLE}
                  onChange={event => updateAutoClassifierDraft({ content: event.target.value })}
                />
              </Form.Item>
            </Form>
          </div>
        </Space>
      )}

      <Dialog open={editorOpen} onOpenChange={open => !open && closeEditor()}>
        <DialogContent
          className="max-h-[calc(100dvh-32px)] overflow-hidden p-0 sm:max-w-[min(760px,calc(100vw-48px))]"
          aria-describedby={undefined}
        >
          {activeStyle && (
            <div className="flex max-h-[calc(100dvh-32px)] flex-col">
              <div className="border-b border-border/70 px-6 py-4 pr-14">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {styleLabels[activeStyle]}
                </DialogTitle>
                <Text type="secondary" style={{ display: 'block', marginTop: 6, lineHeight: 1.7 }}>
                  {t(`operationStrategy.stylePrompts.${activeStyle}.description`)}
                </Text>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <Form layout="vertical" form={form} className="space-y-4">
                  <div style={CONFIG_PANEL_STYLE}>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Space direction="vertical" size={4}>
                        <Text strong>{t('operationStrategy.fields.replyStyle')}</Text>
                        <Tag color={STYLE_TAG_COLOR[activeStyle]} style={SOFT_BLUE_TAG_STYLE}>
                          {styleLabels[activeStyle]}
                        </Tag>
                      </Space>
                      <Form.Item name="enabled" label={t('operationStrategy.fields.enabled')} valuePropName="checked" style={{ marginBottom: 0 }}>
                        <Switch />
                      </Form.Item>
                    </div>

                    <Form.Item
                      name="content"
                      label={t('operationStrategy.fields.content')}
                      rules={[
                        { required: true, message: t('operationStrategy.validation.required') },
                        { max: 1000, message: t('operationStrategy.validation.max1000') },
                      ]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input.TextArea
                        rows={8}
                        maxLength={1000}
                        showCount
                        placeholder={t(`operationStrategy.stylePrompts.${activeStyle}.placeholder`)}
                        style={TEXTAREA_STYLE}
                      />
                    </Form.Item>
                  </div>

                  <div className="flex items-center justify-between" style={SETTING_TILE_STYLE}>
                    <Text strong>{t('operationStrategy.columns.updatedAt')}</Text>
                    <Text type="secondary">{formatDate(activeTemplate?.updatedAt)}</Text>
                  </div>
                </Form>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-background px-6 py-4">
                <Button autoInsertSpace={false} style={PILL_BUTTON_STYLE} onClick={closeEditor}>
                  <span>{t('operationStrategy.actions.cancel')}</span>
                </Button>
                <Button autoInsertSpace={false} style={SOFT_BLUE_BUTTON_STYLE} loading={savingStyle === activeStyle} onClick={submitActiveStyle}>
                  <span>{t('operationStrategy.actions.save')}</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Space>
  )
}
