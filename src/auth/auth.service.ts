import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDto } from './dto/auth.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NotificationsService } from '../notifications/notifications.service';

export function generateSecureSuffix() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  const char1 = alphabet[Math.floor(Math.random() * alphabet.length)];
  const char2 = alphabet[Math.floor(Math.random() * alphabet.length)];

  return char1 + char2;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private httpService: HttpService,
    private notificationsService: NotificationsService,
  ) {}

  // 1. РЕГИСТРАЦИЯ
  async register(dto: AuthDto, ip: string, userAgent: string, res: Response) {
    // Проверяем, занят ли логин
    const candidate = await this.prisma.user.findUnique({
      where: { login: dto.login },
    });

    if (candidate) {
      throw new ConflictException(
        'Пользователь с таким логином уже существует',
      );
    }

    // Хешируем пароль
    const hashedPassword = await argon2.hash(dto.password);

    // Выполняем все создания в единой транзакции базы данных
    const { user, session } = await this.prisma.$transaction(async (tx) => {
      // Создаем пользователя
      const newUser = await tx.user.create({
        data: {
          login: dto.login,
          password: hashedPassword,
        },
      });

      // Создаем персональное приватное пространство задач
      const newWorkspace = await tx.workspace.create({
        data: {
          name: `Личное пространство (${dto.login})`,
          isPrivate: true,
          code:
            dto.login.toUpperCase().substring(0, 2) +
            generateSecureSuffix().toUpperCase(), // Префикс на основе логина
        },
      });

      // Назначаем пользователя АДМИНОМ в этом пространстве
      await tx.workspaceMember.create({
        data: {
          userId: newUser.id,
          workspaceId: newWorkspace.id,
          role: 'ADMIN',
        },
      });

      // Определяем локацию по IP (заглушка, позже прикрутим внешний API)
      const location = await this.getLocationByIp(ip);

      // Создаем сессию
      const newSession = await tx.session.create({
        data: {
          userId: newUser.id,
          ip,
          userAgent,
          location,
        },
      });

      return { user: newUser, session: newSession };
    });

    // Устанавливаем куку и возвращаем данные пользователя
    this.issueCookie(res, user.id, session.id);

    return {
      id: user.id,
      login: user.login,
      createdAt: user.createdAt,
    };
  }

  // 2. ВХОД (ЛОГИН)
  async login(dto: AuthDto, ip: string, userAgent: string, res: Response) {
    // Ищем пользователя
    const user = await this.prisma.user.findUnique({
      where: { login: dto.login },
    });

    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    // Проверяем пароль
    const isPasswordValid = await argon2.verify(user.password, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const location = await this.getLocationByIp(ip);

    // Создаем новую запись сессии при входе
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ip,
        userAgent,
        location,
      },
    });

    // Устанавливаем куку
    this.issueCookie(res, user.id, session.id);

    // В конце метода login(), перед return:
    this.notificationsService.emit({
      type: 'LOGIN',
      targetUserId: user.id, // Отправляем именно этому пользователю
      data: {
        message: `Новый вход в систему! Устройство: ${userAgent}, IP: ${ip}, Локация: ${location}`,
      },
    });

    return {
      id: user.id,
      login: user.login,
    };
  }

  // 3. ВЫХОД (РАЗЛОГИН)
  async logout(sessionId: string, res: Response) {
    // Удаляем сессию из БД
    await this.prisma.session.delete({
      where: { id: sessionId },
    });

    // Стираем куку у клиента
    res.clearCookie('accessToken');
    return { success: true, message: 'Вы успешно вышли из системы' };
  }

  // 4. ПОЛУЧЕНИЕ СЕССИЙ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
  async getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 5. УДАЛЕНИЕ ЧУЖОЙ СЕССИИ (ЗАВЕРШЕНИЕ СЕССИИ)
  async terminateSession(userId: string, sessionIdToKill: string) {
    // Ищем сессию и проверяем, принадлежит ли она этому пользователю
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionIdToKill,
        userId: userId,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Сессия не найдена или доступ запрещен');
    }

    await this.prisma.session.delete({
      where: { id: sessionIdToKill },
    });

    return { success: true, message: 'Сессия успешно завершена' };
  }

  // ХЕЛПЕР: Установка HttpOnly куки с JWT внутри
  private issueCookie(res: Response, userId: string, sessionId: string) {
    const payload = { sub: userId, sessionId };
    const token = this.jwtService.sign(payload);

    res.cookie('accessToken', token, {
      httpOnly: true, // Защита от XSS (недоступно из document.cookie)
      secure: false, // false, так как разворачиваем локально без HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // Срок жизни куки равен JWT (7 дней)
    });
  }

  private async getLocationByIp(ip: string): Promise<string> {
    // Очищаем IP от IPv6-обертки локалхоста (бывает в некоторых системах как ::ffff:127.0.0.1)
    const cleanIp = ip.replace('::ffff:', '');

    if (cleanIp === '::1' || cleanIp === '127.0.0.1') {
      return 'Локальный хост';
    }

    if (cleanIp === '0.0.0.0') {
      return 'Неизвестное местоположени';
    }

    try {
      // Делаем асинхронный запрос к ip-api.com с требованием вернуть ответ на русском языке
      const response = await firstValueFrom(
        this.httpService.get<{
          city?: string;
          country?: string;
          status: string;
        }>(`http://ip-api.com/json/{cleanIp}?lang=ru`),
      );

      if (response.data && response.data.status === 'success') {
        const country = response.data.country || 'Неизвестная страна';
        const city = response.data.city || 'Неизвестный город';
        return `${city}, ${country}`; // Склеиваем строку вида "Тула, Россия"
      }

      return 'Неизвестная локация';
    } catch {
      // Если внешний сервис упал или нет интернета, приложение не должно ломаться
      return 'Ошибка определения геопозиции';
    }
  }
}
