import {
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UsersService } from './users.service';
import { SearchUserDto } from './dto/search-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Пользователи (Users)')
@UseGuards(JwtAuthGuard) // Искать могут только авторизованные пользователи
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Получить список пользователей по логину',
  })
  @Get()
  async getUsers(@Query() query: SearchUserDto) {
    return this.usersService.findAll(query);
  }

  @ApiOperation({ summary: 'Удалить свой аккаунт из системы' })
  @Delete('me')
  async deleteMe(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.usersService.removeSelf(userId);

    // Стираем куку авторизации, так как пользователя больше нет
    res.clearCookie('accessToken');

    return result;
  }

  @ApiOperation({
    summary: 'Загрузить аватарку пользователя (Макс. 5 МБ, png/jpeg)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Put('me/avatar')
  @UseInterceptors(FileInterceptor('file')) // Перехватываем файл из поля 'file'
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // Ограничение 500 КБ
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }), // Только картинки
        ],
      }),
    )
    file: { buffer: Buffer },
  ) {
    return this.usersService.updateAvatar(userId, file.buffer);
  }

  @ApiOperation({ summary: 'Получить аватарку пользователя в виде картинки' })
  @Get(':id/avatar')
  async getAvatar(@Param('id') userId: string, @Res() res: Response) {
    const avatarBuffer = await this.usersService.getAvatar(userId);

    // Если у пользователя нет аватарки, можно вернуть 404 или дефолтную заглушку
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(avatarBuffer);
  }
}
