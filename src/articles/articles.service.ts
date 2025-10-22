import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PrismaClient } from '../../generated/prisma';
import slugify from 'slugify';

@Injectable()
export class ArticlesService {
  private prisma = new PrismaClient();

  private generateSlug(title: string, baseSlug?: string): string {
    if (baseSlug) {
      return slugify(baseSlug, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    return slugify(title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.post.findUnique({
        where: { slug: uniqueSlug },
      });

      if (!existing || (excludeId && existing.id === excludeId)) {
        break;
      }

      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  }

  async create(createArticleDto: CreateArticleDto) {
    const { tagIds, slug: providedSlug, title, ...articleData } = createArticleDto;

    // Generate slug from title or use provided slug
    const baseSlug = this.generateSlug(title, providedSlug);
    const uniqueSlug = await this.ensureUniqueSlug(baseSlug);

    const article = await this.prisma.post.create({
      data: {
        ...articleData,
        title,
        slug: uniqueSlug,
        tags: tagIds ? {
          create: tagIds.map(tagId => ({
            tag: {
              connect: { id: tagId }
            }
          }))
        } : undefined
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        category: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    return article;
  }

  async findAll() {
    return await this.prisma.post.findMany({
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        category: true,
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOne(id: string) {
    const article = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        category: true,
        tags: {
          include: {
            tag: true
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true
              }
            },
            replies: true
          },
          where: {
            approved: true,
            parentId: null
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    // Increment view count
    await this.prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } }
    });

    return article;
  }

  async findBySlug(slug: string) {
    const article = await this.prisma.post.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        category: true,
        tags: {
          include: {
            tag: true
          }
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true
              }
            },
            replies: true
          },
          where: {
            approved: true,
            parentId: null
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!article) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }

    // Increment view count
    await this.prisma.post.update({
      where: { slug },
      data: { viewCount: { increment: 1 } }
    });

    return article;
  }

  async update(id: string, updateArticleDto: UpdateArticleDto) {
    const { tagIds, slug: providedSlug, title, ...articleData } = updateArticleDto;

    // Check if article exists
    const existingArticle = await this.findOne(id);

    // Generate new slug if title is updated
    let updatedData = { ...articleData };

    if (title || providedSlug) {
      const titleToUse = title || existingArticle.title;
      const baseSlug = this.generateSlug(titleToUse, providedSlug);
      const uniqueSlug = await this.ensureUniqueSlug(baseSlug, id);
      updatedData = { ...updatedData, slug: uniqueSlug };
    }

    if (title) {
      updatedData = { ...updatedData, title };
    }

    // If tagIds are provided, update them
    if (tagIds !== undefined) {
      // Delete existing tags
      await this.prisma.postTag.deleteMany({
        where: { postId: id }
      });

      // Create new tags
      if (tagIds.length > 0) {
        await this.prisma.postTag.createMany({
          data: tagIds.map(tagId => ({
            postId: id,
            tagId
          }))
        });
      }
    }

    const article = await this.prisma.post.update({
      where: { id },
      data: updatedData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        category: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    });

    return article;
  }

  async remove(id: string) {
    await this.findOne(id);

    return await this.prisma.post.delete({
      where: { id }
    });
  }

  async publish(id: string) {
    await this.findOne(id);

    return await this.prisma.post.update({
      where: { id },
      data: {
        published: true,
        publishedAt: new Date()
      }
    });
  }

  async unpublish(id: string) {
    await this.findOne(id);

    return await this.prisma.post.update({
      where: { id },
      data: {
        published: false
      }
    });
  }
}
