import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Photo } from './photo.schema';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';
import * as ffmpeg from 'fluent-ffmpeg';
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

@Injectable()
export class PhotoService {
  private compressedFolder = './public/compressed'; 

  constructor(
    @InjectModel('Photo') private readonly photoModel: Model<Photo>,
  ) {
    if (!fs.existsSync(this.compressedFolder)) {
      fs.mkdirSync(this.compressedFolder, { recursive: true });
    }
    // Configurar ffmpeg usando @ffmpeg-installer/ffmpeg
    console.log('ffmpeg path:', ffmpegInstaller.path);
    try {
      ffmpeg.setFfmpegPath(ffmpegInstaller.path);
      console.log('FFmpeg configurado correctamente en:', ffmpegInstaller.path);
    } catch (error) {
      console.error('Error configurando ffmpeg:', error);
    }
  }

  async extractFirstFrame(videoPath: string): Promise<string> {
    console.log('Intentando extraer frame de:', videoPath);
    const fileName = path.basename(videoPath, path.extname(videoPath)) + '.jpg';
    const outputPath = path.join(this.compressedFolder, fileName);
    console.log('Output path:', outputPath);

    // Verificar que el archivo de video existe
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video no encontrado: ${videoPath}`);
    }
    console.log('Video encontrado, iniciando extracción...');

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:01'],
          filename: fileName,
          folder: this.compressedFolder,
          size: '1200x?'
        })
        .on('end', () => {
          console.log(`Frame extraído: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (error, stdout, stderr) => {
          console.error('Error detallado de ffmpeg:');
          console.error('Error:', error.message);
          console.error('stdout:', stdout);
          console.error('stderr:', stderr);
          reject(new Error(`Error al extraer frame del video: ${error.message}`));
        });
    });
  }

  async compressImage(imagePath: string): Promise<string> {
    const fileName = path.basename(imagePath);
    const outputPath = path.join(this.compressedFolder, fileName);

    try {
      await sharp(imagePath)
        .resize(800) // Redimensionar a un ancho máximo de 800px (ajústalo según tu necesidad)
        .jpeg({ quality: 50 }) // Convertir a JPEG con 70% de calidad
        .toFile(outputPath);

      console.log(`Imagen comprimida: ${outputPath}`);
      return outputPath;
    } catch (error) {      
      console.error('Error al comprimir la imagen:', error);
      throw new Error('Error al comprimir la imagen');
    }
  }


  async create(photoDto: { name: string; description?: string; keywords?: string, categoryOne?: number, categoryTwo?: number, title?: string, editorial?: boolean }): Promise<Photo> {
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
                description: jsonObject.description || "",
                keywords: jsonObject.keywords || "",
                categoryOne: jsonObject.categoryOne || "",
                categoryTwo: jsonObject.categoryTwo || "",
            };
        }
    } catch (error) {
        console.error("Error parsing JSON:", error);
    }

    return { title: "", keywords: "" };
}

}