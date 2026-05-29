import type { AcquisitionPlatform } from '@/api/acquisition'
import type { LeadStage, LeadStatus } from '@/api/leads'

export interface LeadLabels {
  stage: Record<LeadStage, string>
  status: Record<LeadStatus, string>
  platform: Record<AcquisitionPlatform, string>
  capabilityStatus: Record<string, string>
  ui: Record<string, string>
}

export const statusColor: Record<LeadStatus, string> = {
  pending: 'orange',
  in_progress: 'blue',
  converted: 'green',
  lost: 'default',
  invalid: 'red',
}
