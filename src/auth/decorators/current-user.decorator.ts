import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Создаем локальный интерфейс для проверки типов линтером
interface RequestWithUser {
  user?: {
    id: string;
    login: string;
    sessionId: string;
    [key: string]: unknown;
  };
}

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) return null;

    return data ? user[data] : user;
  },
);
