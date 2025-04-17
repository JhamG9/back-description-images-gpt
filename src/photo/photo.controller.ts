import { Controller, Post, Body, Get, Query, Put, Param } from '@nestjs/common';
import { PhotoService } from './photo.service';
import OpenAI from 'openai';

@Controller('photos')
export class PhotoController {
  openai = new OpenAI({
    apiKey:
      '',
    dangerouslyAllowBrowser: true,
  });

  IS_EDITORIAL = true; // Si la foto es de tipo editorial o comercial

  folderPhotos = 'jaime-duque'; // fotos en la carpeta /public/sachica
  keywords =
    'jaime duque, jaime duque park foundation, jaime duque bogota, jaime duque park, cundinamarca, cundinamarca colombia, bogota, bogota colombia, colombia tourism, colombia, vacations in colombia, tourism'; // Palabras claves base
  place = 'Jaime Duque Park'; // Lugar de las fotos
  prompt = `Analiza la imagen adjunta y genera: 
  1️⃣ Un título en inglés (máximo 200 caracteres) que describa claramente la escena, optimizado para Shutterstock y Adobe Stock.
  2️⃣ 50 palabras clave en inglés, separadas por comas, sin tildes y en minúsculas. Incluye estas palabras base: ${this.keywords}. Completa con términos relevantes según la imagen y palabras claves base.  
  
  📌 Ubicación: ${this.place}.
  🔎 Usa referencias visuales para mejorar la precisión de palabras clave y recuerda que son 50 palabras claves.

  📂 Selecciona la categoría principal (categoryOne) y una secundaria (categoryTwo) de esta lista según la imagen. Usa el **value** numérico de cada una:

  [
    { "label": "Abstract", "value": 26 },
    { "label": "Animals/Wildlife", "value": 1 },
    { "label": "Arts", "value": 11 },
    { "label": "Backgrounds/Textures", "value": 3 },
    { "label": "Beauty/Fashion", "value": 27 },
    { "label": "Buildings/Landmarks", "value": 2 },
    { "label": "Business/Finance", "value": 4 },
    { "label": "Celebrities", "value": 31 },
    { "label": "Education", "value": 5 },
    { "label": "Food and drink", "value": 6 },
    { "label": "Healthcare/Medical", "value": 7 },
    { "label": "Holidays", "value": 8 },
    { "label": "Industrial", "value": 10 },
    { "label": "Interiors", "value": 21 },
    { "label": "Miscellaneous", "value": 22 },
    { "label": "Nature", "value": 12 },
    { "label": "Objects", "value": 9 },
    { "label": "Parks/Outdoor", "value": 25 },
    { "label": "People", "value": 13 },
    { "label": "Religion", "value": 14 },
    { "label": "Science", "value": 15 },
    { "label": "Signs/Symbols", "value": 17 },
    { "label": "Sports/Recreation", "value": 18 },
    { "label": "Technology", "value": 16 },
    { "label": "Transportation", "value": 0 },
    { "label": "Vintage", "value": 24 }
  ]

  📌 Responde **solo en formato JSON** con la siguiente estructura exacta:

  {
    "title": "",
    "keywords": "",
    "categoryOne": value,
    "categoryTwo": value
  }

  🔁 Los valores de categoryOne y categoryTwo deben ser seleccionados del listado según el contenido visual.`;

  // EDITORIAL
  dateEditorial = 'April 30 2024';
  promptEditorial = `Analiza la imagen adjunta y genera: 
  1️⃣ Un título en inglés (máximo 200 caracteres) que describa claramente la escena, optimizado para Shutterstock y Adobe Stock. Tambien es para uso editorial por lo cual el formato es: "${this.place} - ${this.dateEditorial} - Titulo a generar"
  2️⃣ 50 palabras clave en inglés, separadas por comas, sin tildes y en minúsculas. Incluye estas palabras base: ${this.keywords}. Completa con términos relevantes según la imagen y palabras claves base.  
  
  📌 Ubicación: ${this.place}.
  🔎 Usa referencias visuales para mejorar la precisión de palabras clave y recuerda que son 50 palabras claves.

  📂 Selecciona la categoría principal (categoryOne) y una secundaria (categoryTwo) de esta lista según la imagen. Usa el **value** numérico de cada una:

  [
    { "label": "Abstract", "value": 26 },
    { "label": "Animals/Wildlife", "value": 1 },
    { "label": "Arts", "value": 11 },
    { "label": "Backgrounds/Textures", "value": 3 },
    { "label": "Beauty/Fashion", "value": 27 },
    { "label": "Buildings/Landmarks", "value": 2 },
    { "label": "Business/Finance", "value": 4 },
    { "label": "Celebrities", "value": 31 },
    { "label": "Education", "value": 5 },
    { "label": "Food and drink", "value": 6 },
    { "label": "Healthcare/Medical", "value": 7 },
    { "label": "Holidays", "value": 8 },
    { "label": "Industrial", "value": 10 },
    { "label": "Interiors", "value": 21 },
    { "label": "Miscellaneous", "value": 22 },
    { "label": "Nature", "value": 12 },
    { "label": "Objects", "value": 9 },
    { "label": "Parks/Outdoor", "value": 25 },
    { "label": "People", "value": 13 },
    { "label": "Religion", "value": 14 },
    { "label": "Science", "value": 15 },
    { "label": "Signs/Symbols", "value": 17 },
    { "label": "Sports/Recreation", "value": 18 },
    { "label": "Technology", "value": 16 },
    { "label": "Transportation", "value": 0 },
    { "label": "Vintage", "value": 24 }
  ]

  📌 Responde **solo en formato JSON** con la siguiente estructura exacta:

  {
    "title": "",
    "keywords": "",
    "categoryOne": value,
    "categoryTwo": value
  }

  🔁 Los valores de categoryOne y categoryTwo deben ser seleccionados del listado según el contenido visual.`;


  // TODO: Cambiar respuesta a JSON con formato: {title: '', keywords: ''}
  constructor(private readonly photoService: PhotoService) {}

  @Post()
  async create(
    @Body() photoDto: { name: string; description?: string; keywords?: string },
  ) {
    return this.photoService.create(photoDto);
  }

  @Get()
  async findAll() {
    return this.photoService.findAll(); // Llama al servicio para obtener todas las fotos
  }

  @Get('search')
  async findByName(@Query('name') name: string) {
    const data = await this.photoService.findByName(name);
    if (data.length > 0) {
      return data;
    } else {
      const imagePath = `./public/${this.folderPhotos}/${name}`;
      const compressedPath = await this.photoService.compressImage(imagePath);
      const base64Image =
        await this.photoService.convertImageToBase64(compressedPath);
      const completion: any = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.IS_EDITORIAL ? this.promptEditorial : this.prompt,
              },
              {
                type: 'image_url',
                image_url: { url: base64Image },
              },
            ],
          },
        ],
      });
      const dataResponse = completion.choices[0].message.content;


      const { title, keywords, categoryOne, categoryTwo } =
        this.photoService.extractTitleAndKeywords(dataResponse);

        console.log({title, keywords, categoryOne, categoryTwo});
        

      const dataSaved = await this.photoService.create({
        name,
        description: title,
        keywords,
        categoryOne,
        categoryTwo
      });
      return [dataSaved];
    }
  }

  @Put('sold/:id')
  async markAsSold(@Param('id') id: string) {
    return this.photoService.markAsSold(id);
  }

  @Get('load-data')
  async loadDataPhotos() {}
}
