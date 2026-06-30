import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Включаем cookie-parser для работы с куками

  app.use(cookieParser());

  // 2. Включаем глобальную валидацию запросов
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Автоматически удаляет из запроса поля, которых нет в DTO
      transform: true, // Автоматически преобразует типы (например, строку "1" в число 1)
    }),
  );

  // 3. Настраиваем Swagger документацию
  const config = new DocumentBuilder()
    .setTitle('Task Tracker API')
    .setDescription('Документация API')
    .setVersion('1.0')
    .addCookieAuth('auth-cookie', {
      type: 'apiKey',
      in: 'cookie',
      name: 'sessionId', // Имя куки, которую мы будем устанавливать при логине
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // Документация будет доступна по адресу /api/docs

  app.enableCors({
    // Разрешаем запросы с локалхоста практикантов
    // Если у них разные порты, можно использовать регулярное выражение или массив
    origin: true, // true автоматически подставит домен того, кто пришел (удобно для разработки)

    // Обязательный флаг для работы с куками/JWT в Cross-Origin запросах!
    credentials: true,

    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  await app.listen(3000);
}

void bootstrap();
