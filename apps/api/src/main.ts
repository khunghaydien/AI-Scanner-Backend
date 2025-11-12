import { NestFactory } from '@nestjs/core';
import { ApiModule } from './api.module';
import { ResponseInterceptor, HttpExceptionFilter, AllExceptionsFilter } from '@app/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);

  // Enable cookie parser
  app.use(cookieParser());

  // Enable CORS for cookies
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'https://deploy-railway-production-a173.up.railway.app',
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Log để debug
        console.warn(`CORS: Blocked origin: ${origin}`);
        callback(null, true); // Tạm thời allow all, có thể thay đổi thành callback(new Error('Not allowed')) nếu muốn strict
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'x-google-email',
      'x-google-name',
      'x-google-picture',
      'x-facebook-token',
    ],
    exposedHeaders: ['Set-Cookie'],
    optionsSuccessStatus: 204,
  });

  // Apply global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Apply global exception filters
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalFilters(new HttpExceptionFilter());
  
  // Get port from environment variable (Railway uses PORT)
  const port = process.env.PORT || 3030;
  await app.listen(port);
  
  console.log(`🚀 Application is running on port: ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();
