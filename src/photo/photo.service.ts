import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Photo } from './photo.schema';

@Injectable()
export class PhotoService {
  constructor(
    @InjectModel('Photo') private readonly photoModel: Model<Photo>,
  ) {}

  async create(photoDto: { name: string; description?: string; keywords?: string }): Promise<Photo> {
    const newPhoto = new this.photoModel(photoDto);
    return newPhoto.save();
  }

  async findAll(): Promise<Photo[]> {
    return this.photoModel.find({
      $or: [
        { sold: false },  // Fotos con sold = false
        { sold: { $exists: false } }  // Fotos sin el campo sold
      ]
    }).exec(); // Busca todas las fotos en la base de datos
  }

  async findByName(name: string): Promise<Photo[]> {
    return this.photoModel.find({ name: { $regex: name, $options: 'i' } }).exec();
  }

  async markAsSold(id: string): Promise<Photo> {
    return this.photoModel.findByIdAndUpdate(
      id,
      { sold: true }, // Actualizamos el campo 'sold' a true
      { new: true }, // Devuelve el documento actualizado
    ).exec();
  }

}