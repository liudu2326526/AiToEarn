import React from 'react'
import { Space, Select, Input, Button } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useTransClient } from '@/app/i18n/client'
import { useParams } from 'next/navigation'

interface PostMonitorToolbarProps {
  onSearch: (values: any) => void
  onAdd: () => void
}

const PostMonitorToolbar: React.FC<PostMonitorToolbarProps> = ({ onSearch, onAdd }) => {
  const { lng } = useParams()
  const { t } = useTransClient('route')

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 16,
      padding: 14,
      borderBottom: '1px solid #e8edf5',
      background: 'rgba(248, 250, 252, 0.58)',
      backdropFilter: 'blur(12px)',
      flexWrap: 'wrap',
    }}>
      <Space wrap size={12}>
        <Select
          placeholder={t('workData.filter.platform')}
          style={{ width: 148 }}
          allowClear
          onChange={(v) => onSearch({ platform: v })}
        >
          <Select.Option value="xhs">{t('acquisition.platform.xhs')}</Select.Option>
          <Select.Option value="douyin">{t('acquisition.platform.douyin')}</Select.Option>
          <Select.Option value="kwai">{t('acquisition.platform.kwai')}</Select.Option>
        </Select>

        <Select
          placeholder={t('workData.filter.status')}
          style={{ width: 148 }}
          allowClear
          onChange={(v) => onSearch({ monitorStatus: v })}
        >
          <Select.Option value="active">{t('workData.status.active')}</Select.Option>
          <Select.Option value="paused">{t('workData.status.paused')}</Select.Option>
          <Select.Option value="failed">{t('workData.status.failed')}</Select.Option>
          <Select.Option value="archived">{t('workData.status.archived')}</Select.Option>
        </Select>

        <Input
          placeholder={t('workData.filter.keyword')}
          style={{ width: 260 }}
          suffix={<SearchOutlined />}
          onPressEnter={(e) => onSearch({ keyword: (e.target as HTMLInputElement).value })}
        />
      </Space>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={onAdd}
        style={{
          height: 40,
          borderRadius: 999,
          borderColor: '#9bd7ff',
          background: 'rgba(239, 248, 255, 0.92)',
          color: '#1677ff',
          fontWeight: 600,
          boxShadow: '0 8px 18px rgba(22, 119, 255, 0.12)',
        }}
      >
        {t('workData.addBtn')}
      </Button>
    </div>
  )
}

export default PostMonitorToolbar
