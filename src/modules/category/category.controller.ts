import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { BulkCategoryDeleteDto } from './dto/bulk-category.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { CategoryResponseDto, PaginatedCategoryResponseDto } from './dto/category-response.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Create a new category' })
  @ApiOkResponse({
    description: 'Created category or list of categories',
    schema: {
      oneOf: [
        { $ref: '#/components/schemas/CategoryResponseDto' },
        { type: 'array', items: { $ref: '#/components/schemas/CategoryResponseDto' } },
      ],
    },
  })
  async create(@Req() req: RequestWithUser, @Body() body: CreateCategoryDto | CreateCategoryDto[]) {
    return this.categoryService.create(req.user.sub, req.user.role, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories for the current space' })
  @ApiOkResponse({ type: PaginatedCategoryResponseDto })
  async findAll(@Req() req: RequestWithUser, @Query() query: CategoryQueryDto) {
    return this.categoryService.get_all(req.user.sub, query);
  }

  @Patch(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Update a category' })
  async update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete multiple categories' })
  async remove_bulk(@Body() dto: BulkCategoryDeleteDto) {
    return this.categoryService.remove_bulk(dto.ids);
  }

  @Delete(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete a category' })
  async remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
