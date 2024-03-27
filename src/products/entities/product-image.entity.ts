
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';


@Entity()//{ name: 'product_images' }
export class ProductImage {//debe existie en mi product module

    @PrimaryGeneratedColumn()
    id: number;

    @Column('text')
    url: string;

     @ManyToOne(
        () => Product,
        ( product ) => product.images, //se relacion con el campo images de la entidad product
        {  onDelete: 'CASCADE' }
    )
    product: Product
    

}