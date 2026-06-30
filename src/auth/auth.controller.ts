import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Авторизация и Сессии')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Регистрация нового пользователя' })
  @Post('register')
  async register(
    @Body() dto: AuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.register(dto, ip, userAgent, res);
  }

  @ApiOperation({ summary: 'Вход в систему (Логин)' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: AuthDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.login(dto, ip, userAgent, res);
  }

  @ApiOperation({ summary: 'Выход из системы (Разлогин)' })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logout(sessionId, res);
  }

  @ApiOperation({ summary: 'Получить список активных сессий пользователя' })
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@CurrentUser('id') userId: string) {
    return this.authService.getUserSessions(userId);
  }

  @ApiOperation({
    summary: 'Завершить выбранную сессию (удаленно разлогинить устройство)',
  })
  @ApiParam({ name: 'id', description: 'ID удаляемой сессии' })
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  async terminateSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionIdToKill: string,
  ) {
    return this.authService.terminateSession(userId, sessionIdToKill);
  }
}
