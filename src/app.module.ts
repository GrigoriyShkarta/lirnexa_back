import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SpaceModule } from './modules/space/space.module';
import { UserModule } from './modules/user/user.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { CategoryModule } from './modules/category/category.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SpaceModule,
    UserModule,
    MaterialsModule,
    CategoryModule,
  ],
})
/**
 * Root module of the application.
 */
export class AppModule {}
