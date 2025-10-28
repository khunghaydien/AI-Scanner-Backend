import { Controller, Get } from '@nestjs/common';
import { ApiService } from './api.service';
import { ResponseDto } from '@app/common';

@Controller()
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get()
  getHello() {
    const message = this.apiService.getHello();
    return ResponseDto.success(message, 'api_is_running');
  }
}
