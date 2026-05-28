export enum AcquisitionPlatform {
  Xhs = 'xhs',
  Douyin = 'douyin',
  Kwai = 'kwai',
}

export enum AcquisitionDataSource {
  XhsPluginApi = 'xhs_plugin_api',
  XhsBridgeCapture = 'xhs_bridge_capture',
  DouyinOpenApi = 'douyin_open_api',
  ManualSnapshot = 'manual_snapshot',
  DemoSeed = 'demo_seed',
}

export enum AcquisitionCapabilityStatus {
  NotConfigured = 'not_configured',
  PendingAuthorization = 'pending_authorization',
  PermissionRequired = 'permission_required',
  Ready = 'ready',
  Failed = 'failed',
  ManualRequired = 'manual_required',
  PendingConfirmation = 'pending_confirmation',
}

export const ACQUISITION_PROVIDERS = Symbol('ACQUISITION_PROVIDERS')
