import http from '@/utils/request'
import type {
  AccountOpsConfig,
  AccountOpsConfigRow,
  CreateHookTemplatePayload,
  CreateScriptTemplatePayload,
  HookTemplate,
  ScriptTemplate,
  StrategyListResponse,
  UpdateHookTemplatePayload,
  UpdateScriptTemplatePayload,
  UpsertAccountOpsConfigPayload,
} from './types/operationStrategy'

function unwrap<T>(response: any, fallback: string): T {
  if (!response || String(response.code) !== '0')
    throw new Error(response?.message || fallback)
  return response.data
}

export async function listHookTemplates(params: Record<string, string | number | boolean | undefined>) {
  return unwrap<StrategyListResponse<HookTemplate>>(
    await http.get('acquisition/strategy/hooks', params),
    'list hook templates failed',
  )
}

export async function createHookTemplate(data: CreateHookTemplatePayload) {
  return unwrap<HookTemplate>(
    await http.post('acquisition/strategy/hooks', data),
    'create hook template failed',
  )
}

export async function updateHookTemplate(id: string, data: UpdateHookTemplatePayload) {
  return unwrap<HookTemplate>(
    await http.patch(`acquisition/strategy/hooks/${id}`, data),
    'update hook template failed',
  )
}

export async function deleteHookTemplate(id: string) {
  return unwrap<{ deleted: boolean }>(
    await http.delete(`acquisition/strategy/hooks/${id}`),
    'delete hook template failed',
  )
}

export async function listScriptTemplates(params: Record<string, string | number | boolean | undefined>) {
  return unwrap<StrategyListResponse<ScriptTemplate>>(
    await http.get('acquisition/strategy/scripts', params),
    'list script templates failed',
  )
}

export async function createScriptTemplate(data: CreateScriptTemplatePayload) {
  return unwrap<ScriptTemplate>(
    await http.post('acquisition/strategy/scripts', data),
    'create script template failed',
  )
}

export async function updateScriptTemplate(id: string, data: UpdateScriptTemplatePayload) {
  return unwrap<ScriptTemplate>(
    await http.patch(`acquisition/strategy/scripts/${id}`, data),
    'update script template failed',
  )
}

export async function deleteScriptTemplate(id: string) {
  return unwrap<{ deleted: boolean }>(
    await http.delete(`acquisition/strategy/scripts/${id}`),
    'delete script template failed',
  )
}

export async function listAccountOpsConfigs() {
  return unwrap<{ list: AccountOpsConfigRow[] }>(
    await http.get('acquisition/strategy/accounts/configs'),
    'list account operation configs failed',
  )
}

export async function getAccountOpsConfig(accountId: string) {
  return unwrap<AccountOpsConfig | null>(
    await http.get(`acquisition/strategy/accounts/${accountId}/config`),
    'get account operation config failed',
  )
}

export async function upsertAccountOpsConfig(accountId: string, data: UpsertAccountOpsConfigPayload) {
  return unwrap<AccountOpsConfig>(
    await http.post(`acquisition/strategy/accounts/${accountId}/config`, data),
    'upsert account operation config failed',
  )
}
