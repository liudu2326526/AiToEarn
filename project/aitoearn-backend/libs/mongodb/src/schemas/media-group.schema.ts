/*
 * @Author: nevin
 * @Date: 2024-09-02 14:45:57
 * @LastEditTime: 2025-02-22 12:37:22
 * @LastEditors: nevin
 * @Description: 媒体库 mediaGroup
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { UserType } from '@yikart/common'
import { DEFAULT_SCHEMA_OPTIONS } from '../mongodb.constants'
import { MediaType } from './media.schema'
import { WithTimestampSchema } from './timestamp.schema'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'mediaGroup' })
export class MediaGroup extends WithTimestampSchema {
  id: string

  @Prop({
    required: true,
    index: true,
    type: String,
  })
  userId: string

  @Prop({
    required: true,
    index: true,
    default: UserType.User,
    type: String,
  })
  userType: UserType

  @Prop({
    required: true,
    enum: MediaType,
    index: true,
    type: String,
  })
  type: MediaType

  @Prop({
    required: true,
    type: String,
  })
  title: string

  @Prop({
    required: false,
    type: String,
  })
  desc?: string

  // 是否默认
  @Prop({
    required: true,
    index: true,
    default: false,
    type: Boolean,
  })
  isDefault: boolean
}

export const MediaGroupSchema = SchemaFactory.createForClass(MediaGroup)
