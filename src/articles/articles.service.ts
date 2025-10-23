import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PrismaClient } from '../../generated/prisma';
import slugify from 'slugify';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class ArticlesService {
  private prisma = new PrismaClient();

  private hashIp(ip: string): string {
    return CryptoJS.SHA256(ip).toString();
  }

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

  private async ensureUniqueSlug(
    slug: string,
    excludeId?: string,
  ): Promise<string> {
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
    const {
      tagIds,
      tags,
      categoryId,
      category,
      slug: providedSlug,
      title,
      ...articleData
    } = createArticleDto;

    // Generate slug from title or use provided slug
    const baseSlug = this.generateSlug(title, providedSlug);
    const uniqueSlug = await this.ensureUniqueSlug(baseSlug);

    // Handle category - create if name is provided, otherwise use ID
    let finalCategoryId: string;

    if (category) {
      if (category.id) {
        // Use existing category ID
        finalCategoryId = category.id;
      } else if (category.name) {
        // Create or get existing category by name
        const categorySlug = slugify(category.name, {
          lower: true,
          strict: true,
          remove: /[*+~.()'"!:@]/g,
        });

        let existingCategory = await this.prisma.category.findUnique({
          where: { slug: categorySlug },
        });

        if (!existingCategory) {
          existingCategory = await this.prisma.category.create({
            data: {
              name: category.name,
              slug: categorySlug,
              description: category.description,
              color: category.color,
              icon: category.icon,
            },
          });
        }

        finalCategoryId = existingCategory.id;
      } else {
        throw new Error('Category must have either id or name');
      }
    } else if (categoryId) {
      // Backward compatibility
      finalCategoryId = categoryId;
    } else {
      throw new Error('Category is required');
    }

    // Handle tags - create if names are provided, otherwise use IDs
    const tagConnections: Array<{ tag: { connect: { id: string } } }> = [];

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        if (tag.id) {
          // Use existing tag ID
          tagConnections.push({
            tag: { connect: { id: tag.id } },
          });
        } else if (tag.name) {
          // Create or get existing tag by name
          const tagSlug = slugify(tag.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          });

          let existingTag = await this.prisma.tag.findUnique({
            where: { slug: tagSlug },
          });

          if (!existingTag) {
            existingTag = await this.prisma.tag.create({
              data: {
                name: tag.name,
                slug: tagSlug,
              },
            });
          }

          tagConnections.push({
            tag: { connect: { id: existingTag.id } },
          });
        }
      }
    } else if (tagIds && tagIds.length > 0) {
      // Backward compatibility
      tagConnections.push(
        ...tagIds.map((tagId) => ({
          tag: { connect: { id: tagId } },
        })),
      );
    }

    const article = await this.prisma.post.create({
      data: {
        ...articleData,
        title,
        slug: uniqueSlug,
        categoryId: finalCategoryId,
        tags:
          tagConnections.length > 0
            ? {
                create: tagConnections,
              }
            : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
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
            image: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
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
            image: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            replies: true,
          },
          where: {
            approved: true,
            parentId: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    // Increment view count
    await this.prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return article;
  }

  async findBySlug(slug: string, ip: string) {
    const article = await this.prisma.post.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            replies: true,
          },
          where: {
            approved: true,
            parentId: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!article) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }

    // Hash the IP address
    const hashedIp = this.hashIp(ip);

    // Check if this IP has already viewed this article
    const existingView = await this.prisma.postViewed.findFirst({
      where: {
        postId: article.id,
        viewerIp: hashedIp,
      },
    });

    // Only increment view count if this is a new viewer
    if (!existingView) {
      await this.prisma.$transaction([
        // Create the view record
        this.prisma.postViewed.create({
          data: {
            postId: article.id,
            viewerIp: hashedIp,
          },
        }),
        // Increment view count
        this.prisma.post.update({
          where: { id: article.id },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
    }

    return article;
  }

  async update(id: string, updateArticleDto: UpdateArticleDto) {
    const {
      tagIds,
      tags,
      categoryId,
      category,
      slug: providedSlug,
      title,
      ...articleData
    } = updateArticleDto;

    // Check if article exists
    const existingArticle = await this.findOne(id);

    // Generate new slug if title is updated
    let updatedData: any = { ...articleData };

    if (title || providedSlug) {
      const titleToUse = title || existingArticle.title;
      const baseSlug = this.generateSlug(titleToUse, providedSlug);
      const uniqueSlug = await this.ensureUniqueSlug(baseSlug, id);
      updatedData.slug = uniqueSlug;
    }

    if (title) {
      updatedData.title = title;
    }

    // Handle category update - create if name is provided, otherwise use ID
    if (category) {
      if (category.id) {
        updatedData.categoryId = category.id;
      } else if (category.name) {
        // Create or get existing category by name
        const categorySlug = slugify(category.name, {
          lower: true,
          strict: true,
          remove: /[*+~.()'"!:@]/g,
        });

        let existingCategory = await this.prisma.category.findUnique({
          where: { slug: categorySlug },
        });

        if (!existingCategory) {
          existingCategory = await this.prisma.category.create({
            data: {
              name: category.name,
              slug: categorySlug,
              description: category.description,
              color: category.color,
              icon: category.icon,
            },
          });
        }

        updatedData.categoryId = existingCategory.id;
      }
    } else if (categoryId) {
      updatedData.categoryId = categoryId;
    }

    // Handle tags update - create if names are provided, otherwise use IDs
    if (tags !== undefined || tagIds !== undefined) {
      // Delete existing tags
      await this.prisma.postTag.deleteMany({
        where: { postId: id },
      });

      const tagsToConnect: string[] = [];

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          if (tag.id) {
            tagsToConnect.push(tag.id);
          } else if (tag.name) {
            // Create or get existing tag by name
            const tagSlug = slugify(tag.name, {
              lower: true,
              strict: true,
              remove: /[*+~.()'"!:@]/g,
            });

            let existingTag = await this.prisma.tag.findUnique({
              where: { slug: tagSlug },
            });

            if (!existingTag) {
              existingTag = await this.prisma.tag.create({
                data: {
                  name: tag.name,
                  slug: tagSlug,
                },
              });
            }

            tagsToConnect.push(existingTag.id);
          }
        }
      } else if (tagIds && tagIds.length > 0) {
        tagsToConnect.push(...tagIds);
      }

      // Create new tag connections
      if (tagsToConnect.length > 0) {
        await this.prisma.postTag.createMany({
          data: tagsToConnect.map((tagId) => ({
            postId: id,
            tagId,
          })),
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
            image: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return article;
  }

  async remove(id: string) {
    await this.findOne(id);

    return await this.prisma.post.delete({
      where: { id },
    });
  }

  async publish(id: string) {
    await this.findOne(id);

    return await this.prisma.post.update({
      where: { id },
      data: {
        published: true,
        publishedAt: new Date(),
      },
    });
  }

  async unpublish(id: string) {
    await this.findOne(id);

    return await this.prisma.post.update({
      where: { id },
      data: {
        published: false,
      },
    });
  }

  async likePost(slug: string, ip: string) {
    // Find the post first
    const post = await this.prisma.post.findUnique({
      where: { slug },
    });

    if (!post) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }

    // Hash the IP address
    const hashedIp = this.hashIp(ip);

    // Check if this IP has already liked this post
    const existingLike = await this.prisma.postLiked.findUnique({
      where: {
        postId_likerIp: {
          postId: post.id,
          likerIp: hashedIp,
        },
      },
    });

    if (existingLike) {
      throw new ConflictException('You have already liked this post');
    }

    // Create the like and increment the counter in a transaction
    await this.prisma.$transaction([
      this.prisma.postLiked.create({
        data: {
          postId: post.id,
          likerIp: hashedIp,
        },
      }),
      this.prisma.post.update({
        where: { id: post.id },
        data: { likeCount: { increment: 1 } },
      }),
    ]);

    return {
      success: true,
      message: 'Post liked successfully',
      likeCount: post.likeCount + 1,
    };
  }

  async unlikePost(slug: string, ip: string) {
    // Find the post first
    const post = await this.prisma.post.findUnique({
      where: { slug },
    });

    if (!post) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }

    // Hash the IP address
    const hashedIp = this.hashIp(ip);

    // Check if this IP has liked this post
    const existingLike = await this.prisma.postLiked.findUnique({
      where: {
        postId_likerIp: {
          postId: post.id,
          likerIp: hashedIp,
        },
      },
    });

    if (!existingLike) {
      throw new ConflictException('You have not liked this post');
    }

    // Delete the like and decrement the counter in a transaction
    await this.prisma.$transaction([
      this.prisma.postLiked.delete({
        where: {
          postId_likerIp: {
            postId: post.id,
            likerIp: hashedIp,
          },
        },
      }),
      this.prisma.post.update({
        where: { id: post.id },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);

    return {
      success: true,
      message: 'Post unliked successfully',
      likeCount: Math.max(0, post.likeCount - 1),
    };
  }

  async checkIfLiked(slug: string, ip: string): Promise<boolean> {
    // Find the post first
    const post = await this.prisma.post.findUnique({
      where: { slug },
    });

    if (!post) {
      throw new NotFoundException(`Article with slug ${slug} not found`);
    }

    // Hash the IP address
    const hashedIp = this.hashIp(ip);

    // Check if this IP has liked this post
    const existingLike = await this.prisma.postLiked.findUnique({
      where: {
        postId_likerIp: {
          postId: post.id,
          likerIp: hashedIp,
        },
      },
    });

    return !!existingLike;
  }
}
