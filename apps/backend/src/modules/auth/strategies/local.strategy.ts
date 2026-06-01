import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { UserDocument } from '../../../database/schemas/user.schema';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<UserDocument> {
    const result = await this.authService.login({ email, password });
    if (!result) {
      throw new UnauthorizedException();
    }
    // Return a minimal object — passport attaches it to req.user
    return { id: result.userId, username: result.username } as unknown as UserDocument;
  }
}
