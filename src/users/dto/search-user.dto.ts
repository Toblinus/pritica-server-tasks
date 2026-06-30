import { IsOptional, IsString, MinLength } from 'class-validator';

export class SearchUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Поисковый запрос не должен быть пустым' })
  login?: string;
}
