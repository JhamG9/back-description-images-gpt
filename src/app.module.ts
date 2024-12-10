import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { PhotoModule } from './photo/photo.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/your-database-name'),
    PhotoModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // Ruta absoluta a la carpeta pública
      serveRoot: '/static', // Ruta base desde donde se accederá a las imágenes
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
