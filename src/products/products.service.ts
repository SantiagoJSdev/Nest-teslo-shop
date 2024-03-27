import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
//import { isUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid';
import { ProductImage } from './entities';

@Injectable()
export class ProductsService {

  private readonly logger = new Logger('ProductsService');// para manejar logs le paso el nombre de la clase asi manejo ese contexto

  constructor(

    @InjectRepository(Product)//para trabajar con el patron repository debe inyectarse el repositorio con la clase entidad
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource, //para trabajar con transacciones sabe cual es la cadena d conexion usuario y pass tiene la misma config q Repository
  ) { }

  async create(createProductDto: CreateProductDto) {
    //Usar el patron repository
    try {
      const { images = [], ...productDetails } = createProductDto;

      //cree un before     @BeforeInsert()
      const product = this.productRepository.create({
        ...productDetails,
        images: images.map(image => this.productImageRepository.create({ url: image })),//estoy creando una instancia de productImage dentro de cada producto
      });
      await this.productRepository.save(product);

      return { ...product, images };

    } catch (error) {
      this.handleDBExceptions(error);
    }

  }


  async findAll(paginationDto: PaginationDto) {

    const { limit = 10, offset = 0 } = paginationDto;

    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      relations: {
        images: true, //trae las imagenes le estoy diciendo que la relacion images es true
      }
    })
    return products.map((product) => ({
      ...product,
      images: product.images.map(img => img.url)
    }))
  }

  async findOne(term: string) {
    let product: Product;

    if (isUUID(term)) {
      // product = await this.productRepository.findOne({ where: {id: term}, relations: {images: true} }); esto seria si no tuviera el eager true en la entity
      product = await this.productRepository.findOneBy({ id: term }); //en la entity active el eager true para que traiga las imagenes cm relacion
    } else {
      const queryBuilder = this.productRepository.createQueryBuilder('prod'); //aca le estoy colocando un alias a la tabla product
      product = await queryBuilder
        .where('UPPER(title) =:title or slug =:slug', {
          title: term.toUpperCase(),
          slug: term.toLowerCase(),
        })
        .leftJoinAndSelect('prod.images', 'prod') //luego en mi lef join digo prod.images que es la relacion que tengo en la entity y a mi tabla imagenes le pongo un alias prodImages
        .getOne(); //contruimo una query con el querybuilder =:title luego se pasa el valor como segundo parametro y en getOne() para que traiga uno solo 
      //puede tener otro en otra posicion de memoria  
    }

    if (!product)
      throw new NotFoundException(`Product with ${term} not found`);

    return product;
  }

  async findOnePlain(term: string) {
    const { images = [], ...rest } = await this.findOne(term);
    return {
      ...rest,
      images: images.map(image => image.url)
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto) {

    const { images, ...toUpdate } = updateProductDto;

    const product = await this.productRepository.preload({
      id: id,
      ...toUpdate
      //...updateProductDto,
      // images: [], 
    });

    if (!product) throw new NotFoundException(`Product with id: ${id} not found`);

    // Create query runner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      if (images) {
        await queryRunner.manager.delete(ProductImage, { product: { id: id } }); //le paso mi entity ProductImage y el id del producto q vams a borrar 
        //voy a barrar todas las imagenes cuyo producto sea igual a ese id
        product.images = images.map(
          image => this.productImageRepository.create({ url: image })
        )
      }

      // await this.productRepository.save( product );
      await queryRunner.manager.save(product); //aun no impacto en la base de datos

      await queryRunner.commitTransaction();
      await queryRunner.release(); //despues de hacer la transaccion se libera el queryRunner

      return this.findOnePlain(id);

    } catch (error) {

      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDBExceptions(error);
    }

    /* try {
       await this.productRepository.save( product );
       return product;
       
     } catch (error) {
       this.handleDBExceptions(error);
     }
     */

  }

  async remove(id: string) {
    //deberia eliminar mediante una transancion with the queryRunner eliminar todas las imagenes del producto y luego eliminar el producto
    //pero voy hacerlo d manera sencilla eliminar el producto y sus relaciones en cascada
    const product = await this.findOne(id); // sino existe arroja un error y no va borrar nada
    await this.productRepository.remove(product);
  }

  private handleDBExceptions(error: any) {

    if (error.code === '23505')
      throw new BadRequestException(error.detail);

    this.logger.error(error)
    // console.log(error)
    throw new InternalServerErrorException('Unexpected error, check server logs');

  }

  async deleteAllProducts() {
    const query = this.productRepository.createQueryBuilder('product');
    //puedo poner una condicion q si estoy en produccion no se borren todos los productos
    try {
      return await query
        .delete()
        .where({})
        .execute();

    } catch (error) {
      this.handleDBExceptions(error);
    }

  }


}
