import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class StatsService {
  private prisma = new PrismaClient();

  async getDashboardStats() {
    // Get articles statistics
    const totalArticles = await this.prisma.post.count();
    const publishedArticles = await this.prisma.post.count({
      where: { published: true }
    });
    const draftArticles = await this.prisma.post.count({
      where: { published: false }
    });

    // Get total views
    const viewsResult = await this.prisma.post.aggregate({
      _sum: {
        viewCount: true
      }
    });
    const totalViews = viewsResult._sum.viewCount || 0;

    // Get categories and tags count
    const totalCategories = await this.prisma.category.count();
    const totalTags = await this.prisma.tag.count();

    // Get recent articles
    const recentArticles = await this.prisma.post.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            name: true
          }
        },
        category: {
          select: {
            name: true
          }
        }
      }
    });

    // Get most viewed article
    const mostViewedArticle = await this.prisma.post.findFirst({
      orderBy: { viewCount: 'desc' },
      select: {
        title: true,
        viewCount: true
      }
    });

    return {
      articles: {
        total: totalArticles,
        published: publishedArticles,
        draft: draftArticles
      },
      views: {
        total: totalViews,
        mostViewed: mostViewedArticle
      },
      content: {
        categories: totalCategories,
        tags: totalTags
      },
      recentActivity: recentArticles.map(article => ({
        id: article.id,
        title: article.title,
        action: article.published ? 'Article published' : 'Draft saved',
        author: article.author.name,
        category: article.category.name,
        createdAt: article.createdAt,
        publishedAt: article.publishedAt
      }))
    };
  }
}
