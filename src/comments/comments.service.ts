import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

// Интерфейс для формирования древовидной структуры
export interface CommentNode {
  id: string;
  taskId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  author: { id: string; login: string };
  replies: CommentNode[];
}

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  // 1. СОЗДАНИЕ КОММЕНТАРИЯ
  async create(taskId: string, authorId: string, dto: CreateCommentDto) {
    // Проверяем, что задача существует в этом пространстве
    const task = await this.prisma.task.findFirst({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Задача не найдена');

    // Если это ответ, проверяем существование родительского комментария
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, taskId },
      });
      if (!parent)
        throw new NotFoundException('Родительский комментарий не найден');
    }

    return this.prisma.comment.create({
      data: {
        taskId,
        authorId,
        content: dto.content,
        parentId: dto.parentId || null,
      },
      include: { author: { select: { id: true, login: true } } },
    });
  }

  // ОБНОВЛЕННЫЙ МЕТОД UPDATE
  async update(commentId: string, authorId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    }); // Ищем строго по id
    if (!comment) throw new NotFoundException('Комментарий не найден');

    if (comment.authorId !== authorId) {
      throw new ForbiddenException(
        'Вы можете редактировать только собственные комментарии',
      );
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
    });
  }

  // ОБНОВЛЕННЫЙ МЕТОД REMOVE
  async remove(commentId: string, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    }); // Ищем строго по id
    if (!comment) throw new NotFoundException('Комментарий не найден');

    const isModerator = ['ADMIN', 'EDITOR'].includes(userRole);
    const isAuthor = comment.authorId === userId;

    if (!isModerator && !isAuthor) {
      throw new ForbiddenException(
        'У вас нет прав на удаление этого комментария',
      );
    }

    await this.deleteCommentBranch(commentId);
    return {
      success: true,
      message: 'Комментарий и вся его ветка успешно удалены',
    };
  }

  // Helper для рекурсивного каскадного удаления ветки ответов
  private async deleteCommentBranch(commentId: string) {
    const replies = await this.prisma.comment.findMany({
      where: { parentId: commentId },
    });
    for (const reply of replies) {
      await this.deleteCommentBranch(reply.id);
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  // 4. ПОЛУЧЕНИЕ ПЛОСКИМ СПИСКОМ
  async getFlatList(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, login: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // 5. ПОЛУЧЕНИЕ ДЕРЕВОМ
  async getTree(taskId: string) {
    const allComments = await this.prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, login: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Строим карту (Map) для быстрого O(N) превращения плоского списка в дерево
    const nodesMap = new Map<string, CommentNode>();
    allComments.forEach((c) => {
      nodesMap.set(c.id, { ...c, replies: [] });
    });

    const rootNodes: CommentNode[] = [];

    nodesMap.forEach((node) => {
      if (node.parentId === null) {
        rootNodes.push(node);
      } else {
        const parentNode = nodesMap.get(node.parentId);
        if (parentNode) {
          parentNode.replies.push(node);
        } else {
          // Если родитель был удален модератором поштучно, сироту поднимаем в корень
          rootNodes.push(node);
        }
      }
    });

    return rootNodes;
  }
}
