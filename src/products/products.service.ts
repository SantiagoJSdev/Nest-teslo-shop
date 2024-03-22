import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common'; 
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProductsService');
  
  constructor(

    @InjectRepository(Product)//para trabajar con el patron repository debe inyectarse el repositorio con la clase entidad
    private readonly productRepository: Repository<Product>,

  ) {}
  
  async create(createProductDto: CreateProductDto) {
   //Usar el patron repository
   try {

    const product = this.productRepository.create(createProductDto);
    await this.productRepository.save( product );

    return product;
    
  } catch (error) {
    this.handleDBExceptions(error);
  }

  }
   

  findAll() {
    return `This action returns all products`;
  }

  findOne(id: number) {
    return `This action returns a #${id} product`;
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }

  private handleDBExceptions( error: any ) {

    if ( error.code === '23505' )
      throw new BadRequestException(error.detail);
    
    this.logger.error(error)
    // console.log(error)
    throw new InternalServerErrorException('Unexpected error, check server logs');

  }
}