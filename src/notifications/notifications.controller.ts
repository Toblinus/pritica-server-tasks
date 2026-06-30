import { Controller, Sse, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard.js';

@ApiTags('Realtime Уведомления (SSE)')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({
    summary:
      'Полноценный постоянный SSE-канал персональных уведомлений пользователя',
  })
  @UseGuards(JwtAuthGuard) // Авторизация через куки
  @Sse('user') // URL: /notifications/user
  streamUserEvents(
    @CurrentUser('id') userId: string,
  ): Observable<{ data: any }> {
    return this.notificationsService.subscribeToUserEvents(userId);
  }

  @ApiOperation({
    summary: 'SSE-подписка на обновления конкретной задачи (Поля, комментарии)',
  })
  @ApiParam({ name: 'taskId', description: 'ID задачи' })
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard) // Гвард дополнительно проверит, что юзер состоит в проекте этой задачи
  @Sse('task/:taskId') // URL: /notifications/task/{taskId}
  streamTaskEvents(@Param('taskId') taskId: string): Observable<{ data: any }> {
    return this.notificationsService.subscribeToTaskEvents(taskId);
  }
}
