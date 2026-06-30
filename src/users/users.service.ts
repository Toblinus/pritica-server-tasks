import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchUserDto } from './dto/search-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: SearchUserDto) {
    return this.prisma.user.findMany({
      where: {
        // Если передан login, ищем по совпадению (LIKE), иначе возвращаем всех
        login: query.login
          ? {
              contains: query.login,
              mode: 'insensitive', // Поиск независим от регистра
            }
          : undefined,
      },
      select: {
        id: true,
        login: true,
        createdAt: true,
        // Поле password намеренно исключено из select в целях безопасности
      },
      orderBy: { login: 'asc' },
      take: 50, // Ограничим выдачу до 50 пользователей, чтобы не перегружать сеть
    });
  }

  async removeSelf(userId: string) {
    // 1. Находим пространства, где пользователь является ADMIN
    const adminWorkspaces = await this.prisma.workspaceMember.findMany({
      where: { userId, role: 'ADMIN' },
      include: { workspace: true },
    });

    // 2. Для каждого такого пространства проверяем, нет ли там других админов
    for (const member of adminWorkspaces) {
      const totalAdmins = await this.prisma.workspaceMember.count({
        where: { workspaceId: member.workspaceId, role: 'ADMIN' },
      });

      // Если он единственный админ в публичном/командном пространстве,
      // мы заставляем его либо удалить проект, либо передать права
      if (totalAdmins === 1 && !member.workspace.isPrivate) {
        throw new ForbiddenException(
          `Вы не можете удалить аккаунт, пока являетесь единственным владельцем пространства "${member.workspace.name}". Передайте права или удалите проект.`,
        );
      }
    }

    // 3. Выполняем удаление пользователя в транзакции
    await this.prisma.$transaction(async (tx) => {
      // Автоматически удаляем все приватные пространства этого пользователя
      // (так как там больше никто не состоит и они привязаны к нему)
      const privateWorkspaces = await tx.workspaceMember.findMany({
        where: { userId, role: 'ADMIN', workspace: { isPrivate: true } },
      });

      for (const pw of privateWorkspaces) {
        await tx.workspace.delete({ where: { id: pw.workspaceId } });
      }

      // Удаляем самого пользователя
      // Все связи WorkspaceMember, Task (где он исполнитель) и Session удалятся каскадно [3]
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return {
      success: true,
      message: 'Ваш аккаунт и связанные сессии успешно удалены',
    };
  }

  async updateAvatar(userId: string, buffer: Buffer) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: new Uint8Array(buffer) },
    });
    return { success: true, message: 'Аватарка успешно обновлена' };
  }

  async getAvatar(userId: string): Promise<Buffer> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    // Если аватарки в базе нет, сгенерируем или выбросим ошибку (либо отдадим пустой буфер)
    if (!user || !user.avatar) {
      throw new NotFoundException('Аватарка не найдена');
    }

    return Buffer.from(user.avatar);
  }
}
