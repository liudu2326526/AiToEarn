/**
 * 队列名称枚举
 * 统一管理所有队列的名称
 */
export enum QueueName {
  /** 发布任务队列 */
  PostPublish = 'post_publish',

  /** 发布媒体任务队列（Meta平台） */
  PostMediaTask = 'post_media_task',

  /** AI图片异步生成队列 */
  AiImageAsync = 'ai_image_async',

  /** 互动任务分发队列 */
  EngagementTaskDistribution = 'engagement_task_distribution',

  /** 评论回复任务队列 */
  EngagementReplyToComment = 'engagement_reply_to_comment_task',

  /** dump social media avatar queue */
  DumpSocialMediaAvatar = 'dump_social_media_avatar',

  /** 更新发布任务队列 */
  UpdatePublishedPost = 'update_published_post',

  /** 通知队列 */
  Notification = 'bull_notification',

  /** AI任务失败退款处理队列 */
  AiTaskRefund = 'ai_task_refund',

  /** DraftGeneration 生成队列 */
  DraftGeneration = 'place_draft_generation',

  /** DraftGeneration 低优先级生成队列 */
  DraftGenerationLowPriority = 'place_draft_generation_low_priority',

  /** 用户事件批量写入队列 */
  UserEventBatch = 'user_event_batch',
  /** 获客评论抓取队列 */
  AcquisitionCommentFetch = 'acquisition_comment_fetch',

  /** 获客作品回填队列 */
  AcquisitionPostBackfill = 'acquisition_post_backfill',

  /** 获客线索通知队列 */
  AcquisitionLeadNotify = 'acquisition_lead_notify',

  /** 获客敏感词检查队列 */
  AcquisitionSensitiveCheck = 'acquisition_sensitive_check',

  /** 获客线索自动回复执行队列 */
  AcquisitionLeadReplyTask = 'acquisition_lead_reply_task',
}
