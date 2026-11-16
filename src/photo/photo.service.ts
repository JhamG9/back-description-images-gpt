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

  async extractVideoFrames(videoPath: string, frameCount: number = 5): Promise<string[]> {
    console.log(`Extrayendo ${frameCount} frames de:`, videoPath);
    
    // Verificar que el archivo de video existe
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video no encontrado: ${videoPath}`);
    }

    // Primero, obtener la duración del video
    const duration = await this.getVideoDuration(videoPath);
    console.log(`Duración del video: ${duration} segundos`);

    // Calcular timestamps distribuidos a lo largo del video
    const timestamps = this.calculateTimestamps(duration, frameCount);
    console.log('Timestamps a extraer:', timestamps);

    const videoName = path.basename(videoPath, path.extname(videoPath));
    const framePaths: string[] = [];

    // Extraer cada frame
    for (let i = 0; i < timestamps.length; i++) {
      const fileName = `${videoName}_frame${i + 1}.jpg`;
      const outputPath = path.join(this.compressedFolder, fileName);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .screenshots({
            timestamps: [timestamps[i]],
            filename: fileName,
            folder: this.compressedFolder,
            size: '1024x?'
          })
          .on('end', () => {
            console.log(`Frame ${i + 1} extraído: ${outputPath}`);
            framePaths.push(outputPath);
            resolve();
          })
          .on('error', (error) => {
            console.error(`Error al extraer frame ${i + 1}:`, error.message);
            reject(new Error(`Error al extraer frame ${i + 1}: ${error.message}`));
          });
      });
    }

    return framePaths;
  }

  private getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }

  private calculateTimestamps(duration: number, frameCount: number): number[] {
    const timestamps: number[] = [];
    
    // Siempre empezar en el segundo 1
    timestamps.push(1);
    
    if (frameCount === 1) {
      return timestamps;
    }

    // El último frame debe ser un poco antes del final (para evitar problemas)
    const endTime = Math.max(1, duration - 1);
    
    if (frameCount === 2) {
      timestamps.push(endTime);
      return timestamps;
    }

    // Calcular los frames intermedios distribuidos uniformemente
    const interval = (endTime - 1) / (frameCount - 1);
    
    for (let i = 1; i < frameCount - 1; i++) {
      timestamps.push(1 + (interval * i));
    }
    
    // Agregar el último frame
    timestamps.push(endTime);
    
    return timestamps;
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
        // 1024px y calidad 75: el modelo distingue mejor los detalles
        // (texturas, letreros, especies) a un costo extra pequeño
        .rotate() // respeta la orientación EXIF
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75 })
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

  /**
   * Parsea la respuesta JSON del modelo (structured outputs) y valida que
   * venga lo mínimo necesario. Lanza error en vez de guardar datos vacíos.
   */
  parseMetadata(
    content: string | null | undefined,
    fileName: string,
  ): {
    title: string;
    description: string;
    keywords: string;
    categoryOne?: number;
    categoryTwo?: number;
  } {
    if (!content) {
      throw new Error(`Respuesta vacía del modelo para ${fileName}`);
    }

    let data: any;
    try {
      data = JSON.parse(content);
    } catch {
      throw new Error(`JSON inválido del modelo para ${fileName}: ${content.slice(0, 200)}`);
    }

    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const keywords = typeof data.keywords === 'string' ? data.keywords.trim() : '';
    if (!title || !keywords) {
      throw new Error(`Faltan title o keywords en la respuesta para ${fileName}`);
    }

    return {
      title,
      description: typeof data.description === 'string' ? data.description.trim() : '',
      keywords,
      categoryOne: Number.isInteger(data.categoryOne) ? data.categoryOne : undefined,
      categoryTwo: Number.isInteger(data.categoryTwo) ? data.categoryTwo : undefined,
    };
  }

  /**
   * Limpia las keywords en código para no depender de que el modelo obedezca:
   * minúsculas, sin tildes ni caracteres especiales, keywords base primero,
   * máximo 2 palabras por keyword generada, sin duplicados (incluye
   * singular/plural) y recortadas a `max`.
   */
  normalizeKeywords(raw: string, baseKeywords: string[] = [], max = 49): string {
    const clean = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Clave para detectar duplicados: "mountains" y "mountain" son lo mismo
    const dedupeKey = (value: string) =>
      value
        .split(' ')
        .map((word) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word))
        .join(' ');

    const result: string[] = [];
    const seen = new Set<string>();
    const add = (keyword: string) => {
      const key = dedupeKey(keyword);
      if (!keyword || seen.has(key)) return;
      seen.add(key);
      result.push(keyword);
    };

    // Las base se respetan tal cual (pueden ser nombres de lugar de 3+ palabras)
    baseKeywords.map(clean).forEach(add);

    for (const item of raw.split(',')) {
      const keyword = clean(item);
      if (!keyword) continue;
      const words = keyword.split(' ');
      if (words.length <= 2) {
        add(keyword);
      } else {
        // Frase demasiado larga: se separa en palabras sueltas sin conectores
        const stopWords = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'under', 'over', 'with', 'and', 'or', 'for', 'to', 'by', 'from']);
        words.filter((word) => !stopWords.has(word)).forEach(add);
      }
    }

    return result.slice(0, max).join(', ');
  }
}