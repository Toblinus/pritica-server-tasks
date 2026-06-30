import { IsString, IsOptional, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Length(1, 1000, {
    message: 'Комментарий должен содержать от 1 до 1000 символов',
  })
  content!: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class UpdateCommentDto {
  @IsString()
  @Length(1, 1000, {
    message: 'Комментарий должен содержать от 1 до 1000 символов',
  })
  content!: string;
}
