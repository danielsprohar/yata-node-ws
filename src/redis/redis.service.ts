import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnApplicationShutdown {
  constructor(config: ConfigService) {
    super({
      host: config.get('REDIS_HOST') ?? 'localhost',
      port: parseInt(config.get('REDIS_PORT') ?? '6379'),
      password: config.get<string>('REDIS_PASSWORD'),
      username: config.get<string>('REDIS_USER'),
    });
  }

  onApplicationShutdown(_signal?: string) {
    this.quit();
  }
}
