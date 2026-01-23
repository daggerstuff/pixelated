import { IsEmail, IsString, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString({}, { message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters' })
  password: string;

  @IsString()
  @IsEqualTo('password', { message: 'Please confirm your password' })
  confirmPassword: string;
}