import { Controller, Post, Body, Get, Query, Put, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhotoService } from './photo.service';
import OpenAI from 'openai';

@Controller('photos')
export class PhotoController {
  private readonly openai: OpenAI;
  
  // Variables de desarrollo - cambiar aquí para hot reload
  isEditorial = false; // Si la foto es de tipo editorial o comercial
  folderPhotos = 'san-agustin'; // fotos en la carpeta /public/
  keywords = 'san agustin, archaeological, park, stone statues, pre columbian art, colombia, unesco world heritage, huila'; // Palabras claves base
  place = 'San Agustin, Huila, Colombia'; // Lugar de las fotos
  dateEditorial = 'September 20 2025';

  private readonly categories = [
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
  ];

  private generatePrompt(isEditorial: boolean): string {
    const descriptionFormat = isEditorial 
      ? `Una descripción en inglés (máximo 200 caracteres) que describa claramente la escena, optimizado para Shutterstock y Adobe Stock. También es para uso editorial por lo cual el formato es: "${this.place} - ${this.dateEditorial} - Titulo a generar"`
      : 'Una descrición en inglés (máximo 200 caracteres) que describa claramente la escena, optimizado para Shutterstock y Adobe Stock.';

    return `Analiza la imagen adjunta y genera: 
  1. Un titulo que sea breve, preciso y descriptivo, este titulo debe de estar en ingles
  2. ${descriptionFormat}
  3. 50 palabras clave en inglés, separadas por comas, sin tildes y en minúsculas. Incluye estas palabras base: ${this.keywords}. Completa con términos relevantes según la imagen y palabras claves base.  
   
  📌 Ubicación: ${this.place}.
  🔎 Usa referencias visuales para mejorar la precisión de palabras clave y recuerda que son 50 palabras claves.

  📂 Selecciona la categoría principal (categoryOne) y una secundaria (categoryTwo) de esta lista según la imagen. Usa el **value** numérico de cada una:

  ${JSON.stringify(this.categories, null, 2)}

  📌 Responde **solo en formato JSON** con la siguiente estructura exacta:

  {
    "title": "",
    "description": "",
    "keywords": "",
    "categoryOne": value,
    "categoryTwo": value
  }
  🔁 Los valores de categoryOne y categoryTwo deben ser seleccionados del listado según el contenido visual.`;
  }


  // TODO: Cambiar respuesta a JSON con formato: {title: '', keywords: ''}
  constructor(
    private readonly photoService: PhotoService,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      dangerouslyAllowBrowser: true,
    });
  }

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
                text: this.generatePrompt(this.isEditorial),
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

      const { title, description, keywords, categoryOne, categoryTwo } =
        this.photoService.extractTitleAndKeywords(dataResponse);

      console.log({ title, description, keywords, categoryOne, categoryTwo });


      const dataSaved = await this.photoService.create({
        name,
        title,
        description,
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
}
