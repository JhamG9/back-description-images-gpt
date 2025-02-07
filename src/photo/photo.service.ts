import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Photo } from './photo.schema';
import * as fs from 'fs';
import * as path from 'path';


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

  async convertImageToBase64(imagePath: string): Promise<string> {
    try {
      const fullPath = path.resolve(imagePath);
      const fileBuffer = fs.readFileSync(fullPath);
      return `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
    } catch (error) {
      console.error('Error reading image file:', error);
      throw new Error('Could not convert image to base64');
    }
  }

  extractTitleAndKeywords(inputString) {
    try {
        // Buscar el JSON dentro del string usando una expresión regular
        const jsonMatch = inputString.match(/\{.*?\}/s);
        
        if (jsonMatch) {
            const jsonString = jsonMatch[0]; // Obtener el JSON como string
            const jsonObject = JSON.parse(jsonString); // Convertirlo en objeto
            
            // Extraer title y keywords si existen
            return {
                title: jsonObject.title || "",
                keywords: jsonObject.keywords || ""
            };
        }
    } catch (error) {
        console.error("Error parsing JSON:", error);
    }

    return { title: "", keywords: "" };
}

}