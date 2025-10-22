import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaClient } from '../../generated/prisma';
import slugify from 'slugify';

@Injectable()
export class CategoriesService {
  private prisma = new PrismaClient();

  private generateSlug(name: string, baseSlug?: string): string {
    if (baseSlug) {
      return slugify(baseSlug, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    return slugify(name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.category.findUnique({
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

  async create(createCategoryDto: CreateCategoryDto) {
    const { slug: providedSlug, name, ...categoryData } = createCategoryDto;

    // Generate slug from name or use provided slug
    const baseSlug = this.generateSlug(name, providedSlug);
    const uniqueSlug = await this.ensureUniqueSlug(baseSlug);

    return await this.prisma.category.create({
      data: {
        ...categoryData,
        name,
        slug: uniqueSlug,
      },
      include: {
        parent: true,
        children: true
      }
    });
  }

  async findAll() {
    return await this.prisma.category.findMany({
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            posts: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        posts: {
          where: {
            published: true
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true
              }
            },
            tags: {
              include: {
                tag: true
              }
            }
          }
        }
      }
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const existingCategory = await this.findOne(id);

    const { slug: providedSlug, name, ...categoryData } = updateCategoryDto;

    let updatedData = { ...categoryData };

    if (name || providedSlug) {
      const nameToUse = name || existingCategory.name;
      const baseSlug = this.generateSlug(nameToUse, providedSlug);
      const uniqueSlug = await this.ensureUniqueSlug(baseSlug, id);
      updatedData = { ...updatedData, slug: uniqueSlug };
    }

    if (name) {
      updatedData = { ...updatedData, name };
    }

    return await this.prisma.category.update({
      where: { id },
      data: updatedData,
      include: {
        parent: true,
        children: true
      }
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return await this.prisma.category.delete({
      where: { id }
    });
  }
}
