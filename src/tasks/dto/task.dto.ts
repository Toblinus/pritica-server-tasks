import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  Length,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../../prisma/generated/client';

export class CreateTaskDto {
  @IsString()
  @Length(3, 100, {
    message: 'Название задачи должно быть от 3 до 100 символов',
  })
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskPriority, { message: 'Некорректный приоритет задачи' })
  @IsOptional()
  priority?: TaskPriority;

  @IsEnum(TaskStatus, { message: 'Некорректный статус задачи' })
  @IsOptional()
  status?: TaskStatus;

  @IsDateString({}, { message: 'Некорректный формат даты дедлайна' })
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @Length(3, 100, {
    message: 'Название задачи должно быть от 3 до 100 символов',
  })
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskPriority, { message: 'Некорректный приоритет задачи' })
  @IsOptional()
  priority?: TaskPriority;

  @IsEnum(TaskStatus, { message: 'Некорректный статус задачи' })
  @IsOptional()
  status?: TaskStatus;

  @IsDateString({}, { message: 'Некорректный формат даты дедлайна' })
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;
}
