import {
  Controller,
  Get,
  Body,
  Param,
  Delete,
  Query,
  Put,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Invoice } from './entities/invoice.entity';
import { ListInvoiceDto } from './dto/list-invoice.dto';
import { type TResponse, type Paginated } from '../../common/types/response';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  paginate(@Query() listInvoiceDto: ListInvoiceDto): Paginated<Invoice> {
    return this.invoiceService.paginate(listInvoiceDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): TResponse<Invoice> {
    const data = await this.invoiceService.findOne(+id);

    return {
      data,
    };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ): TResponse<Invoice> {
    const data = await this.invoiceService.update(+id, updateInvoiceDto);

    return {
      data,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.invoiceService.remove(+id);
  }
}
