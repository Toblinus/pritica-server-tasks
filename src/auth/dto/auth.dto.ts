import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class AuthDto {
  @IsString()
  @MinLength(3, { message: 'Логин должен быть не короче 3 символов' })
  @MaxLength(20, { message: 'Логин должен быть не длиннее 20 символов' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'Логин может содержать только латинские буквы, цифры и знак подчеркивания',
  })
  login!: string;

  @IsString()
  @MinLength(6, { message: 'Пароль должен быть не короче 6 символов' })
  password!: string;
}
