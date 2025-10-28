import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseDto } from '../dto/response.dto';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseDto<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseDto<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();
    const status = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        // If data is already a ResponseDto, return as is
        if (data instanceof ResponseDto) {
          return data;
        }

        // If data is null/undefined, treat as success with no data
        if (data === null || data === undefined) {
          return ResponseDto.success(null, 'Success', status);
        }

        // If data is a string (like "Hello World"), wrap it
        if (typeof data === 'string') {
          return ResponseDto.success(data, 'Success', status);
        }

        // For objects and arrays, wrap them in success response
        return ResponseDto.success(data, 'Success', status);
      })
    );
  }
}
