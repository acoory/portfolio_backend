import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class TagsService {
  private prisma = new PrismaClient();

  async create(createTagDto: CreateTagDto) {
    return await this.prisma.tag.create({
      data: createTagDto
    });
  }

  async findAll() {
    return await this.prisma.tag.findMany({
      include: {
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
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        posts: {
          include: {
            post: {
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    image: true
                  }
                },
                category: true
              }
            }
          }
        }
      }
    });

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }

    return tag;
  }

  async update(id: string, updateTagDto: UpdateTagDto) {
    await this.findOne(id);

    return await this.prisma.tag.update({
      where: { id },
      data: updateTagDto
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return await this.prisma.tag.delete({
      where: { id }
    });
  }
}
