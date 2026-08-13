import { PrismaModule } from './prisma/prisma.module';
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './common/config/app-config.module';
import { HashingModule } from './common/hashing/hashing.module';
import { UploadModule } from './common/upload/upload.module';
import { AuthModule } from './auth/auth.module';
import { SiteConfigModule } from './site-config/site-config.module';
import { TechStackModule } from './tech-stack/tech-stack.module';
import { ExperiencesModule } from './experiences/experiences.module';
import { EducationsModule } from './educations/educations.module';

@Module({
  imports: [
    AppConfigModule.forProject(),
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 1000,
    }),
    HashingModule,
    PrismaModule,
    UploadModule,
    AuthModule,
    SiteConfigModule,
    TechStackModule,
    ExperiencesModule,
    EducationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
