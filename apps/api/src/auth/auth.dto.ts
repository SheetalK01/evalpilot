import { authProvidersSchema, loginSchema, publicUserSchema, registerSchema } from '@evalpilot/shared';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class PublicUserDto extends createZodDto(publicUserSchema) {}
export class AuthProvidersDto extends createZodDto(authProvidersSchema) {}
