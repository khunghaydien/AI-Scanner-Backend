import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ResponseDto } from '../dto/response.dto';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();

    let message = 'An error occurred';
    let errorDetails: any = undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const errorObj = exceptionResponse as any;
      message = errorObj.message || errorObj.error || message;

      if (Array.isArray(errorObj.message)) {
        errorDetails = { validation: errorObj.message };
      } else if (errorObj.message && typeof errorObj.message === 'object') {
        errorDetails = errorObj.message;
      }
    }

    const errorResponse = ResponseDto.error(message, status, {
      code: exception.constructor.name,
      details: errorDetails,
    });

    response.status(status).json(errorResponse);
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.message : 'Internal server error';

    const errorResponse = ResponseDto.internalServerError(message, {
      code: exception.constructor?.name || 'UnknownError',
      details: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
    });

    response.status(status).json(errorResponse);
  }
}
