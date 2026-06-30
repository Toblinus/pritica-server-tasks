import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { TaskStatus } from '../prisma/generated/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(workspaceId: string, authorId: string, dto: CreateTaskDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Пространство задач не найдено');
    }

    if (dto.assigneeId) {
      const isMember = await this.prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: dto.assigneeId, workspaceId } },
      });
      if (!isMember) {
        throw new ForbiddenException(
          'Назначенный исполнитель не состоит в этом пространстве',
        );
      }
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const lastTask = await tx.task.findFirst({
        where: { workspaceId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });

      const nextNumber = lastTask ? lastTask.number + 1 : 1;

      return tx.task.create({
        data: {
          workspaceId,
          number: nextNumber,
          authorId,
          assigneeId: dto.assigneeId,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          status: dto.status || TaskStatus.TODO, // Явно проставляем TODO, если статус не передан
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        },
      });
    });

    if (task.assigneeId) {
      this.notificationsService.emit({
        type: 'TASK_ASSIGNED',
        targetUserId: task.assigneeId,
        data: {
          taskId: task.id,
          title: task.title,
          message: 'На вас завели новую задачу',
        },
      });
    }

    return {
      ...task,
      code: `${workspace.code}-${task.number}`,
    };
  }

  async findAllInWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { code: true },
    });

    if (!workspace) {
      throw new NotFoundException('Пространство задач не найдено');
    }

    const tasks = await this.prisma.task.findMany({
      where: { workspaceId },
      orderBy: { number: 'asc' },
      include: {
        author: { select: { id: true, login: true } },
        assignee: { select: { id: true, login: true } },
      },
    });

    return tasks.map((task) => ({
      ...task,
      code: `${workspace.code}-${task.number}`,
    }));
  }

  // ОБНОВЛЕННЫЙ МЕТОД PATCH
  async update(taskId: string, userRole: string, dto: UpdateTaskDto) {
    // Ищем задачу просто по её ID
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    if (userRole === 'EXECUTOR') {
      const updateFields = Object.keys(dto).filter(
        (key) => dto[key as keyof UpdateTaskDto] !== undefined,
      );
      const triesToUpdateOtherFields = updateFields.some(
        (field) => field !== 'status',
      );
      if (triesToUpdateOtherFields) {
        throw new ForbiddenException(
          'Исполнитель имеет право изменять только статус задачи',
        );
      }
    }

    if (dto.assigneeId) {
      const isMember = await this.prisma.workspaceMember.findUnique({
        // Берем workspaceId прямо из найденной таски!
        where: {
          userId_workspaceId: {
            userId: dto.assigneeId,
            workspaceId: task.workspaceId,
          },
        },
      });
      if (!isMember) {
        throw new ForbiddenException(
          'Назначенный исполнитель не состоит в этом пространстве',
        );
      }
    }

    if (dto.assigneeId) {
      this.notificationsService.emit({
        type: 'TASK_ASSIGNED',
        targetUserId: dto.assigneeId,
        data: {
          taskId: task.id,
          title: task.title,
          message: 'На вас завели новую задачу',
        },
      });
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        status: dto.status,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  // ОБНОВЛЕННЫЙ МЕТОД DELETE
  async remove(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Задача не найдена');
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    return { success: true, message: 'Задача успешно удалена' };
  }
}
