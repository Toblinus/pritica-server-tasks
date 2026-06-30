import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

// Интерфейс того, что зашито внутри JWT payload
export interface JwtPayload {
  sub: string; // userId
  sessionId: string; // id сессии из БД
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      // Извлекаем JWT напрямую из куки по имени accessToken
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request): string | null => {
          if (req && req.cookies) {
            return (req.cookies['accessToken'] as string) || null;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key-change-me',
    });
  }

  // Сюда попадает уже успешно расшифрованный и проверенный валидатором JWT
  async validate(payload: JwtPayload) {
    // Дополнительная проверка: проверяем, существует ли еще эта сессия в БД
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Сессия завершена или не существует');
    }

    // Возвращаем пользователя и ID сессии — они запишутся в req.user
    return {
      id: session.user.id,
      login: session.user.login,
      sessionId: session.id,
    };
  }
}
