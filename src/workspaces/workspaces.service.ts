import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkspaceDto,
  AddMemberDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  // Создание нового пространства с автоматической ролью ADMIN для создателя
  async create(dto: CreateWorkspaceDto, userId: string) {
    const existingCode = await this.prisma.workspace.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (existingCode) {
      throw new ConflictException(
        'Пространство задач с таким кодом уже существует',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          code: dto.code.toUpperCase(),
          isPrivate: dto.isPrivate ?? false,
        },
      });

      await tx.workspaceMember.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: 'ADMIN',
        },
      });

      return workspace;
    });
  }

  // Получить все пространства, в которых состоит текущий пользователь
  async getUserWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        _count: { select: { tasks: true, members: true } },
      },
    });
  }

  // Добавить нового пользователя в пространство (Доступно только ADMIN)
  async addMember(workspaceId: string, dto: AddMemberDto) {
    // 1. Находим само пространство, чтобы проверить его тип
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Пространство задач не найдено');
    }

    // 2. Блокируем добавление участников, если пространство приватное
    if (workspace.isPrivate) {
      throw new ForbiddenException(
        'В приватные пространства нельзя добавлять новых участников',
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!targetUser) {
      throw new NotFoundException('Добавляемый пользователь не найден');
    }

    const alreadyMember = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId: dto.userId, workspaceId },
      },
    });

    if (alreadyMember) {
      throw new ConflictException(
        'Пользователь уже состоит в этом пространстве',
      );
    }

    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: dto.userId,
        role: dto.role,
      },
    });
  }

  // Удалить пользователя из пространства (Доступно только ADMIN)
  async removeMember(workspaceId: string, memberId: string) {
    return this.prisma.workspaceMember.delete({
      where: {
        userId_workspaceId: { userId: memberId, workspaceId },
      },
    });
  }

  async getAllMembers(workspaceId: string) {
    const users = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
      },
      select: {
        role: true,
        userId: true,
        user: {
          select: {
            id: true,
            login: true,
          },
        },
      },
    });

    return users;
  }

  // Обновление данных пространства
  async update(workspaceId: string, dto: UpdateWorkspaceDto) {
    // Если обновляется код, проверяем его на уникальность
    if (dto.code) {
      const existingCode = await this.prisma.workspace.findFirst({
        where: {
          code: dto.code.toUpperCase(),
          NOT: { id: workspaceId },
        },
      });
      if (existingCode) {
        throw new ConflictException(
          'Пространство задач с таким кодом уже существует',
        );
      }
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: dto.name,
        code: dto.code ? dto.code.toUpperCase() : undefined,
        isPrivate: dto.isPrivate,
      },
    });
  }

  async changeMemberRole(
    workspaceId: string,
    userId: string,
    role: AddMemberDto['role'],
  ) {
    // 1. Находим само пространство, чтобы проверить его тип
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Пространство задач не найдено');
    }

    // 2. Блокируем добавление участников, если пространство приватное
    if (workspace.isPrivate) {
      throw new ForbiddenException(
        'В приватные пространства нельзя добавлять новых участников',
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException('Добавляемый пользователь не найден');
    }

    return this.prisma.workspaceMember.update({
      data: {
        role,
      },
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
      select: {
        userId: true,
        role: true,
      },
    });
  }

  // Полное удаление пространства задач
  async remove(workspaceId: string) {
    // Благодаря каскадному удалению в схеме Prisma (onDelete: Cascade),
    // вместе с пространством удалятся все его участники (WorkspaceMember) и задачи (Task)
    await this.prisma.workspace.delete({
      where: { id: workspaceId },
    });
    return { success: true, message: 'Пространство задач успешно удалено' };
  }
}
