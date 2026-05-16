import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator'

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters' })
  password!: string

  @IsString()
  @IsPasswordMatch('password', { message: 'Please confirm your password' })
  confirmPassword!: string
}

function IsPasswordMatch(
  targetProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isPasswordMatch',
      target: object.constructor,
      propertyName,
      constraints: [targetProperty],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [comparisonProperty] = args.constraints as [string]
          return (
            typeof value === 'string' &&
            value ===
              (args.object as Record<string, unknown>)[comparisonProperty]
          )
        },
      },
    })
  }
}
