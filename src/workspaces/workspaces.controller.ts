import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import {
  CreateWorkspaceDto,
  AddMemberDto,
  UpdateWorkspaceDto,
  UpdateMemberRoleWorkspaceDto,
} from './dto/workspace.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceRoles } from './decorators/roles.decorator';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { TasksService } from '../tasks/tasks.service';
import { CreateTaskDto } from '../tasks/dto/task.dto';

@ApiTags('Пространства задач (Workspaces)')
@UseGuards(JwtAuthGuard) // Все эндпоинты требуют авторизации через куки
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly tasksService: TasksService,
  ) {}

  @ApiOperation({ summary: 'Создать новое пространство задач' })
  @Post()
  async create(
    @Body() dto: CreateWorkspaceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.workspacesService.create(dto, userId);
  }

  @ApiOperation({ summary: 'Получить список моих пространств' })
  @Get()
  async getMyWorkspaces(@CurrentUser('id') userId: string) {
    return this.workspacesService.getUserWorkspaces(userId);
  }

  @ApiOperation({ summary: 'Редактировать параметры пространства задач' })
  @ApiParam({ name: 'workspaceId', description: 'ID пространства' })
  @WorkspaceRoles('ADMIN') // Изменять настройки может только ADMIN
  @UseGuards(WorkspaceRoleGuard)
  @Patch(':workspaceId')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(workspaceId, dto);
  }

  @ApiOperation({ summary: 'Удалить пространство задач' })
  @ApiParam({ name: 'workspaceId', description: 'ID пространства' })
  @WorkspaceRoles('ADMIN') // Удалять проект может только ADMIN
  @UseGuards(WorkspaceRoleGuard)
  @Delete(':workspaceId')
  async remove(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.remove(workspaceId);
  }

  @ApiOperation({ summary: 'Добавить участника в пространство задач' })
  @ApiParam({ name: 'workspaceId', description: 'ID пространства' })
  @WorkspaceRoles('ADMIN') // Только админ может добавлять людей
  @UseGuards(WorkspaceRoleGuard)
  @Post(':workspaceId/members')
  async addMember(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.workspacesService.addMember(workspaceId, dto);
  }

  @ApiOperation({ summary: 'Удалить участника из пространства задач' })
  @ApiParam({ name: 'workspaceId', description: 'ID пространства' })
  @ApiParam({ name: 'userId', description: 'ID удаляемого пользователя' })
  @WorkspaceRoles('ADMIN') // Только админ может удалять людей
  @UseGuards(WorkspaceRoleGuard)
  @Delete(':workspaceId/members/:userId')
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') memberId: string,
  ) {
    return this.workspacesService.removeMember(workspaceId, memberId);
  }

  @ApiOperation({ summary: 'Изменить роль участника' })
  @ApiParam({ name: 'workspaceId', description: 'ID пространства' })
  @ApiParam({ name: 'userId', description: 'ID изменяемого пользователя' })
  @WorkspaceRoles('ADMIN') // Только админ может изменять роль людей
  @UseGuards(WorkspaceRoleGuard)
  @Patch(':workspaceId/members/:userId')
  async changeMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') memberId: string,
    @Body() dto: UpdateMemberRoleWorkspaceDto,
  ) {
    return this.workspacesService.changeMemberRole(
      workspaceId,
      memberId,
      dto.role,
    );
  }

  @ApiOperation({ summary: 'Создать новую задачу в пространстве' })
  @ApiParam({ name: 'workspaceId', description: 'ID пространства задач' })
  @WorkspaceRoles('ADMIN', 'EDITOR') // Защита ролевым гвардом пространства
  @UseGuards(WorkspaceRoleGuard)
  @Post(':workspaceId/tasks') // Красивый вложенный путь
  async createAdjacentTask(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser('id') authorId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(workspaceId, authorId, dto);
  }

  @ApiOperation({ summary: 'Получить список всех задач пространства' })
  @ApiParam({ name: 'workspaceId', description: 'ID пространства задач' })
  @UseGuards(WorkspaceRoleGuard) // Наблюдатели тоже могут читать, поэтому декоратор ролей не нужен
  @Get(':workspaceId/tasks') // Красивый вложенный путь
  async getAdjacentTasks(@Param('workspaceId') workspaceId: string) {
    return this.tasksService.findAllInWorkspace(workspaceId);
  }

  @ApiOperation({ summary: 'Получить список всех участников пространства' })
  @ApiParam({ name: 'workspaceId', description: 'ID пространства задач' })
  @Get(':workspaceId/members')
  async getMembersList(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getAllMembers(workspaceId);
  }
}
