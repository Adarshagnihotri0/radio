import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokensDto> {
    const existing = await this.userModel
      .findOne({ $or: [{ email: dto.email }, { username: dto.username }] })
      .lean()
      .exec();

    if (existing) {
      throw new ConflictException('Username or email already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    try {
      const user = await this.userModel.create({
        username: dto.username,
        email: dto.email,
        passwordHash,
        location: { type: 'Point', coordinates: [0, 0] },
      });

      return this.issueTokens(user);
    } catch {
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async login(dto: LoginDto): Promise<AuthTokensDto> {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .select('+passwordHash')
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<AuthTokensDto> {
    const user = await this.userModel
      .findById(userId)
      .select('+refreshTokenHash')
      .exec();

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token invalid');
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isValid) {
      throw new UnauthorizedException('Refresh token invalid');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash: null }).exec();
  }

  async validateUserById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId).exec();
  }

  private async issueTokens(user: UserDocument): Promise<AuthTokensDto> {
    const payload: JwtPayload = { sub: user.id as string, username: user.username };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.config.getOrThrow<string>('jwt.refreshExpiresIn'),
    });

    // Store hashed refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, this.SALT_ROUNDS);
    await this.userModel.findByIdAndUpdate(user.id, { refreshTokenHash }).exec();

    return {
      accessToken,
      refreshToken,
      userId: user.id as string,
      username: user.username,
    };
  }
}
