import { Module } from '@nestjs/common'
import { SensitiveWordService } from './sensitive-word.service'

@Module({
  providers: [SensitiveWordService],
  exports: [SensitiveWordService],
})
export class SensitiveWordModule {}
