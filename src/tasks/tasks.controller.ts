import {
  Controller,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Req,
  Get,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { UpdateTaskDto } from './dto/task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRoles } from '../workspaces/decorators/roles.decorator';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard';
import { CommentsService } from '../comments/comments.service';
import { CreateCommentDto } from '../comments/dto/comment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface AuthenticatedWorkspaceRequest {
  workspaceRole?: string;
}

@ApiTags('Задачи (Tasks)')
@UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
@Controller('tasks') // 1. МЕНЯЕМ БАЗОВЫЙ ПУТЬ НА ЧИСТЫЙ /tasks
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly commentsService: CommentsService,
  ) {}

  @ApiOperation({ summary: 'Обновить задачу (Частично или полностью)' })
  @ApiParam({ name: 'taskId', description: 'ID задачи' })
  @WorkspaceRoles('ADMIN', 'EDITOR', 'EXECUTOR')
  @Patch(':taskId')
  async update(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: AuthenticatedWorkspaceRequest,
  ) {
    const userRole = req.workspaceRole || 'OBSERVER';
    return this.tasksService.update(taskId, userRole, dto);
  }

  @ApiOperation({ summary: 'Удалить задачу из пространства' })
  @ApiParam({ name: 'taskId', description: 'ID задачи' })
  @WorkspaceRoles('ADMIN', 'EDITOR')
  @Delete(':taskId') // 5. УБРАЛИ /workspaces/{workspaceId} из пути
  async remove(@Param('taskId') taskId: string) {
    return this.tasksService.remove(taskId);
  }

  @ApiOperation({
    summary: 'Добавить комментарий к задаче (или ответить на другой)',
  })
  @ApiParam({ name: 'taskId', description: 'ID задачи' })
  @Post(':taskId/comments') // Путь на выходе: /tasks/{taskId}/comments
  async createComment(
    @Param('taskId') taskId: string,
    @CurrentUser('id') authorId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(taskId, authorId, dto);
  }

  @ApiOperation({ summary: 'Получить комментарии плоским списком' })
  @ApiParam({ name: 'taskId', description: 'ID задачи' })
  @Get(':taskId/comments/flat') // Путь на выходе: /tasks/{taskId}/comments/flat
  async getFlatComments(@Param('taskId') taskId: string) {
    return this.commentsService.getFlatList(taskId);
  }

  @ApiOperation({ summary: 'Получить комментарии в виде дерева вложений' })
  @ApiParam({ name: 'taskId', description: 'ID задачи' })
  @Get(':taskId/comments/tree') // Путь на выходе: /tasks/{taskId}/comments/tree
  async getTreeComments(@Param('taskId') taskId: string) {
    return this.commentsService.getTree(taskId);
  }
}
