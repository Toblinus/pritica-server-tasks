import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspaceRole } from '../../prisma/generated/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface RequestWithWorkspace {
  user?: {
    id: string;
    login: string;
    sessionId: string;
  };
  params: {
    workspaceId?: string;
    taskId?: string;
    commentId?: string;
  };
  workspaceRole?: WorkspaceRole;
}

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    // Принудительно типизируем объект запроса вместо any
    const request = context.switchToHttp().getRequest<RequestWithWorkspace>();
    const user = request.user;
    // 1. Пытаемся взять workspaceId напрямую из URL
    let workspaceId = request.params.workspaceId;
    const taskId = request.params.taskId;
    const commentId = request.params.commentId;

    // 2. Если его там нет, но есть taskId (как в случае с комментариями),
    // быстро вытягиваем ID пространства из таблицы задач
    if (!workspaceId && taskId) {
      // Обращаемся напрямую через this.prisma, без prismaClient
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { workspaceId: true },
      });
      workspaceId = task?.workspaceId;
    }

    if (!workspaceId && commentId) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
        select: {
          task: {
            select: { workspaceId: true }, // Через связь забираем ID пространства глубоко из базы
          },
        },
      });
      workspaceId = comment?.task?.workspaceId;
    }

    // 3. Если ни того, ни другого не нашлось — блокируем запрос
    if (!workspaceId || !user) {
      throw new ForbiddenException(
        'Не удалось определить контекст пространства задач',
      );
    }
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: workspaceId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException(
        'Вы не состоите в данном пространстве задач',
      );
    }

    const hasPermission = requiredRoles.includes(member.role);
    if (!hasPermission) {
      throw new ForbiddenException(
        'У вас недостаточно прав для выполнения этого действия',
      );
    }

    // Теперь запись безопасна и типизирована
    request.workspaceRole = member.role;

    return true;
  }
}
