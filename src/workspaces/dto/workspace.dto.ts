import { PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @Length(3, 50, { message: 'Название должно быть от 3 до 50 символов' })
  name!: string;

  @IsString()
  @Length(2, 5, {
    message: 'Код должен быть от 2 до 5 символов (например, JIRA)',
  })
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Код может содержать только заглавные латинские буквы и цифры',
  })
  code!: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}

export class AddMemberDto {
  @IsString()
  userId!: string;

  @IsString()
  role!: 'ADMIN' | 'EDITOR' | 'EXECUTOR' | 'OBSERVER';
}

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {}
