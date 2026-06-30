import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');

    console.log(connectionString);

    super({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async onModuleInit() {
    // Подключаемся к базе данных при запуске приложения
    await this.$connect();
  }

  async onModuleDestroy() {
    // Корректно закрываем соединение при остановке сервера
    await this.$disconnect();
  }
}
