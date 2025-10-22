import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CategoryInput {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;
}

class TagInput {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsString()
  @IsNotEmpty()
  authorId: string;

  // Accept either category ID or category object with name to create
  @ValidateNested()
  @Type(() => CategoryInput)
  @IsOptional()
  category?: CategoryInput;

  // For backward compatibility
  @IsString()
  @IsOptional()
  categoryId?: string;

  // Accept array of tag IDs or tag objects with names to create
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TagInput)
  @IsOptional()
  tags?: TagInput[];

  // For backward compatibility
  @IsArray()
  @IsOptional()
  tagIds?: string[];
}
