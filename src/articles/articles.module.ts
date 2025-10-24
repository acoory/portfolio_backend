import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { TranslationService } from './translation.service';

@Module({
  controllers: [ArticlesController],
  providers: [ArticlesService, TranslationService],
})
export class ArticlesModule {}
