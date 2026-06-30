import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { CommentsModule } from './comments/comments.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
      signOptions: { expiresIn: '7d' }, // Сессия будет жить неделю
    }),
    AuthModule,
    WorkspacesModule,
    UsersModule,
    TasksModule,
    CommentsModule,
    NotificationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
