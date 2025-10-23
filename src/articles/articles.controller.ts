import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import {
  Session,
  UserSession,
  AllowAnonymous,
  OptionalAuth,
} from '@thallesp/nestjs-better-auth';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  create(@Body() createArticleDto: CreateArticleDto) {
    return this.articlesService.create(createArticleDto);
  }

  @Get()
  @AllowAnonymous()
  findAll() {
    return this.articlesService.findAll();
  }

  @Get('slug/:slug')
  @AllowAnonymous()
  findBySlug(@Param('slug') slug: string, @Req() req: Request) {
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.ip ||
      'unknown';
    return this.articlesService.findBySlug(slug, ip);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateArticleDto: UpdateArticleDto) {
    return this.articlesService.update(id, updateArticleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }

  @Put(':id/publish')
  publish(@Param('id') id: string) {
    return this.articlesService.publish(id);
  }

  @Put(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.articlesService.unpublish(id);
  }

  @Post('slug/:slug/like')
  @AllowAnonymous()
  likePost(@Param('slug') slug: string, @Req() req: Request) {
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.ip ||
      'unknown';
    return this.articlesService.likePost(slug, ip);
  }

  @Delete('slug/:slug/like')
  @AllowAnonymous()
  unlikePost(@Param('slug') slug: string, @Req() req: Request) {
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.ip ||
      'unknown';
    return this.articlesService.unlikePost(slug, ip);
  }

  @Get('slug/:slug/liked')
  @AllowAnonymous()
  async checkIfLiked(@Param('slug') slug: string, @Req() req: Request) {
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.ip ||
      'unknown';
    const isLiked = await this.articlesService.checkIfLiked(slug, ip);
    return { isLiked };
  }
}
