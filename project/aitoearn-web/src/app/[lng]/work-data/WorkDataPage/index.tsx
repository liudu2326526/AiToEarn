import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Tag, Space, Typography } from 'antd'
import {
  CheckCircleOutlined,
  CloudSyncOutlined,
  CommentOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'
import { useTransClient } from '@/app/i18n/client'
import { useParams } from 'next/navigation'
import PostMonitorToolbar from '../components/PostMonitorToolbar'
import MonitoredPostTable from '../components/MonitoredPostTable'
import AddMonitoredPostDialog from '../components/AddMonitoredPostDialog'
import PostDetailDrawer from '../components/PostDetailDrawer'
import { listMonitoredPosts } from '@/api/workData'
import type { MonitoredPostItem } from '@/api/workData'
import { getAcquisitionCapability } from '@/api/acquisition'
import type { AcquisitionCapabilityResponse, AcquisitionPlatform } from '@/api/acquisition'
import { getAccountListApi } from '@/api/account'
import type { SocialAccount } from '@/api/types/account.type'
import xhsLogo from '@/assets/svgs/plat/xhs.svg'
import douyinLogo from '@/assets/svgs/plat/douyin.svg'
import kwaiLogo from '@/assets/svgs/plat/ks.svg'

const { Text, Title } = Typography

const pageStyle: React.CSSProperties = {
  minHeight: '100%',
  padding: '28px',
  background: 'linear-gradient(180deg, #f6f8fb 0, #ffffff 360px)',
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #e8edf5',
  borderRadius: 8,
  background: 'rgba(255, 255, 255, 0.82)',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.05)',
}

const statCardStyle: React.CSSProperties = {
  height: '100%',
  border: '1px solid #e8edf5',
  borderRadius: 8,
  background: 'rgba(255, 255, 255, 0.82)',
  boxShadow: '0 10px 26px rgba(15, 23, 42, 0.04)',
}

const capabilityCardStyle: React.CSSProperties = {
  height: '100%',
  border: '1px solid #e8edf5',
  borderRadius: 8,
  background: 'rgba(255, 255, 255, 0.74)',
}

const heroStyle: React.CSSProperties = {
  marginBottom: 16,
  border: '1px solid #e8edf5',
  borderRadius: 8,
  background: 'rgba(255, 255, 255, 0.82)',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.05)',
}

const WorkDataPage: React.FC = () => {
  const { lng } = useParams()
  const { t } = useTransClient('route')

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MonitoredPostItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<any>({})

  const [addVisible, setAddVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentPost, setCurrentPost] = useState<MonitoredPostItem | null>(null)

  const [capabilities, setCapabilities] = useState<Record<string, AcquisitionCapabilityResponse>>({})

  const fetchData = async () => {
    setLoading(true)
    try {
      const requestParams = {
        page,
        pageSize,
        ...filters,
      }
      const monitoredRes = await listMonitoredPosts(requestParams)
      setData(monitoredRes.list)
      setTotal(monitoredRes.total)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCapabilities = async () => {
    const accRes = await getAccountListApi()
    if (accRes && accRes.data) {
      const platforms: AcquisitionPlatform[] = ['xhs', 'douyin', 'kwai']
      const caps: Record<string, AcquisitionCapabilityResponse> = {}
      for (const p of platforms) {
        const firstAccount = accRes.data.find(a => a.type === p)
        if (firstAccount) {
          try {
            const cap = await getAcquisitionCapability({ accountId: firstAccount.id, platform: p })
            caps[p] = cap
          } catch (e) {
            console.error(e)
          }
        }
      }
      setCapabilities(caps)
    }
  }

  useEffect(() => {
    fetchData()
  }, [page, pageSize, filters])

  useEffect(() => {
    fetchCapabilities()
  }, [])

  const handleSearch = (newFilters: any) => {
    setFilters((prev: any) => ({ ...prev, ...newFilters }))
    setPage(1)
  }

  const handleViewDetail = (post: MonitoredPostItem) => {
    setCurrentPost(post)
    setDetailVisible(true)
  }

  // Summary statistics
  const stats = {
    total: total,
    ready: data.filter(i => i.fetchStatus === 'ready').length,
    fetching: data.filter(i => i.fetchStatus === 'fetching').length,
    failed: data.filter(i => i.fetchStatus === 'failed').length,
    reviewing: data.filter(i => i.fetchStatus === 'reviewing').length,
    comments: data.reduce((sum, item) => sum + Number(item.latestCommentCount || 0), 0),
  }

  const renderCapabilityStatus = (platform: string) => {
    const cap = capabilities[platform]
    if (!cap) return <Tag style={{ borderRadius: 999 }}>{t('workData.capability.noAccount')}</Tag>

    const statusColorMap: Record<string, string> = {
      ready: 'success',
      permission_required: 'warning',
      not_configured: 'error',
      pending_confirmation: 'processing',
    }

    let cta = ''
    if (cap.status === 'permission_required') {
      cta = t('workData.capability.cta.permission')
    } else if (cap.status === 'not_configured' && platform === 'xhs') {
      cta = t('workData.capability.cta.xhsConfig')
    } else if (cap.status === 'pending_confirmation' && platform === 'kwai') {
      cta = t('workData.capability.cta.kwaiPending')
    }

    return (
      <Space direction="vertical" size={4}>
        <Tag color={statusColorMap[cap.status] || 'default'} style={{ width: 'fit-content', borderRadius: 999 }}>
          {t(`workData.fetchStatus.${cap.status}`)}
        </Tag>
        {cta && <span style={{ fontSize: '12px', color: '#6b7b8c', lineHeight: 1.5 }}>{cta}</span>}
      </Space>
    )
  }

  const statItems = [
    { key: 'total', title: t('workData.stats.total'), value: stats.total, icon: <DatabaseOutlined />, color: '#1677ff' },
    { key: 'ready', title: t('workData.stats.ready'), value: stats.ready, icon: <CheckCircleOutlined />, color: '#0f9f8f' },
    { key: 'fetching', title: t('workData.stats.fetching'), value: stats.fetching, icon: <CloudSyncOutlined />, color: '#3b82f6' },
    { key: 'comments', title: t('workData.stats.comments'), value: stats.comments, icon: <CommentOutlined />, color: '#2f80ed' },
  ]

  const capabilityItems = [
    { key: 'xhs', logo: xhsLogo },
    { key: 'douyin', logo: douyinLogo },
    { key: 'kwai', logo: kwaiLogo },
  ] satisfies Array<{ key: AcquisitionPlatform; logo: string }>

  const getPlatformLabel = (platform: AcquisitionPlatform) => {
    return t(`acquisition.platform.${platform}`)
  }

  const renderPlatformLogo = (item: { key: AcquisitionPlatform; logo: string }) => {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'rgba(248, 250, 252, 0.82)',
          border: '1px solid #e8edf5',
        }}
      >
        <img
          src={item.logo}
          alt={getPlatformLabel(item.key)}
          style={{ width: 28, height: 28, display: 'block', borderRadius: 6 }}
        />
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <Card style={heroStyle} styles={{ body: { padding: 22 } }}>
        <Space direction="vertical" size={4}>
          <Text type="secondary">{t('workData.heroEyebrow')}</Text>
          <Title level={2} style={{ margin: 0, lineHeight: 1.2 }}>
            {t('workData.title')}
          </Title>
          <Text type="secondary" style={{ maxWidth: 760, lineHeight: 1.7 }}>
            {t('workData.description')}
          </Text>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {statItems.map(item => (
          <Col key={item.key} xs={24} sm={12} lg={6}>
            <Card size="small" style={statCardStyle} styles={{ body: { padding: 18 } }}>
              <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                <Statistic title={item.title} value={item.value} valueStyle={{ color: item.color, fontWeight: 700 }} />
                <div style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: `${item.color}14`,
                  color: item.color,
                  fontSize: 20,
                }}>
                  {item.icon}
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title={t('workData.capability.title')} size="small" style={{ ...panelStyle, marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
        <Row gutter={[12, 12]}>
          {capabilityItems.map(item => (
            <Col key={item.key} xs={24} md={8}>
              <Card size="small" style={capabilityCardStyle} styles={{ body: { padding: 14 } }}>
                <Space align="start" size={12}>
                  {renderPlatformLogo(item)}
                  <Space direction="vertical" size={6}>
                    <span style={{ fontWeight: 700, color: '#172435' }}>{getPlatformLabel(item.key)}</span>
                    {renderCapabilityStatus(item.key)}
                  </Space>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card style={panelStyle} styles={{ body: { padding: 0 } }}>
        <PostMonitorToolbar onSearch={handleSearch} onAdd={() => setAddVisible(true)} />
        <MonitoredPostTable
          loading={loading}
          data={data}
          total={total}
          page={page}
          pageSize={pageSize}
          onChange={(p, s) => {
            setPage(p)
            setPageSize(s)
          }}
          onViewDetail={handleViewDetail}
          onRefresh={fetchData}
        />
      </Card>

      <AddMonitoredPostDialog
        visible={addVisible}
        onCancel={() => setAddVisible(false)}
        onSuccess={() => {
          setAddVisible(false)
          fetchData()
        }}
      />

      <PostDetailDrawer
        visible={detailVisible}
        post={currentPost}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  )
}

export default WorkDataPage
