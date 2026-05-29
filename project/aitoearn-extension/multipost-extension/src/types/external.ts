export type ExtensionExternalRequest<T> = {
  type: "request";
  traceId: string;
  action: string;
  data: T;
};

export interface ExtensionExternalResponse<T> {
  type: "response";
  traceId: string;
  action: string;
  code: number;
  message: string;
  data: T;
}

export interface ExtensionPublishAcceptedResult {
  accepted: boolean;
  traceId: string;
  tabs: Array<{
    id?: number;
    url?: string;
    platform: string;
  }>;
  error?: string;
}

export interface ExtensionPublishResultEvent {
  type: "MULTIPOST_EXTENSION_PUBLISH_RESULT";
  traceId: string;
  platform: string;
  success: boolean;
  workLink?: string;
  workId?: string;
  pendingConfirmation?: boolean;
  error?: string;
}

export function successResponse<T>(request: ExtensionExternalRequest<T>, data: T) {
  return {
    type: "response",
    traceId: request.traceId,
    action: request.action,
    code: 0,
    message: "success",
    data,
  };
}
