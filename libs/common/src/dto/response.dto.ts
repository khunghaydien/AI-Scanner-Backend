export interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  message: string;
  data?: T;
  error?: {
    code?: string;
    details?: any;
  };
}

export class ResponseDto<T = any> {
  success: boolean;
  status: number;
  message: string;
  data?: T;
  error?: {
    code?: string;
    details?: any;
  };

  constructor(
    success: boolean,
    status: number,
    message: string,
    data?: T,
    error?: { code?: string; details?: any }
  ) {
    this.success = success;
    this.status = status;
    this.message = message;
    this.data = data;
    this.error = error;
  }

  static success<T>(data: T, message: string = 'Success', status: number = 200): ResponseDto<T> {
    return new ResponseDto(true, status, message, data);
  }

  static error(
    message: string = 'Error',
    status: number = 500,
    error?: { code?: string; details?: any }
  ): ResponseDto {
    return new ResponseDto(false, status, message, undefined, error);
  }

  static created<T>(data: T, message: string = 'success'): ResponseDto<T> {
    return new ResponseDto(true, 201, message, data);
  }

  static badRequest(
    message: string = 'bad_request',
    error?: { code?: string; details?: any }
  ): ResponseDto {
    return new ResponseDto(false, 400, message, undefined, error);
  }

  static unauthorized(
    message: string = 'unauthorized',
    error?: { code?: string; details?: any }
  ): ResponseDto {
    return new ResponseDto(false, 401, message, undefined, error);
  }

  static forbidden(
    message: string = 'forbidden',
    error?: { code?: string; details?: any }
  ): ResponseDto {
    return new ResponseDto(false, 403, message, undefined, error);
  }

  static notFound(
    message: string = 'not_found',
    error?: { code?: string; details?: any }
  ): ResponseDto {
    return new ResponseDto(false, 404, message, undefined, error);
  }

  static conflict(
    message: string = 'conflict',
    error?: { code?: string; details?: any }
  ): ResponseDto {
    return new ResponseDto(false, 409, message, undefined, error);
  }

  static internalServerError(
    message: string = 'internal_server_error',
    error?: { code?: string; details?: any }
  ): ResponseDto {
    return new ResponseDto(false, 500, message, undefined, error);
  }
}
