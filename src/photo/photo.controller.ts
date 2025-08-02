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

  IS_EDITORIAL = false; // Si la foto es de tipo editorial o comercial
  folderPhotos = 'casanare'; // fotos en la carpeta /public/sachica
  keywords = 'casanare, colombia, nature'; // Palabras claves base
  place = 'Casanare, Colombia'; // Lugar de las fotos

  prompt = `Analiza la imagen adjunta y genera:
    1. Un título breve, preciso y descriptivo en inglés.
    2. Una descripción clara en inglés (máximo 200 caracteres), optimizada para bancos de imágenes como Shutterstock, Adobe Stock y Alamy.
    3. 50 palabras clave en inglés, todas en minúsculas, sin tildes, separadas por comas. Usa **solo palabras individuales (no frases compuestas)**. No incluyas keywords duplicadas ni redundantes. Inclye estás palabras base: ${this.keywords}. Dejalas de primeras, y complétalas con términos relevantes que describan con precisión la imagen y su contexto.

    📌 Ubicación: ${this.place}.
    🔎 Usa referencias visuales de la imagen para mejorar la precisión de palabras clave. Asegúrate de que las keywords abarquen elementos físicos, conceptos, emociones, lugares, estilos, acciones y contexto.

    📂 Selecciona la categoría principal (categoryOne) y una secundaria (categoryTwo) desde la siguiente lista. Usa el **value numérico** de cada una:

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

    📌 Devuelve la respuesta **solo en formato JSON** con la siguiente estructura exacta:

    {
      "title": "",
      "description": "",
      "keywords": "",
      "categoryOne": value,
      "categoryTwo": value
    }

  🔁 Los valores categoryOne y categoryTwo deben seleccionarse según el contenido visual.`;

  // EDITORIAL
  dateEditorial = 'April 30 2024';
  promptEditorial = `Analiza la imagen adjunta y genera: 
  1. Un titulo que sea breve, preciso y descriptivo, este titulo debe de estar en ingles.
  2. Una descripción en inglés (máximo 200 caracteres) que describa claramente la escena, optimizado para Shutterstock y Adobe Stock. Tambien es para uso editorial por lo cual el formato es: "${this.place} - ${this.dateEditorial} - Titulo a generar"
  3. 50 palabras clave en inglés, todas en minúsculas, sin tildes, separadas por comas. Usa **solo palabras individuales (no frases compuestas)**. No incluyas keywords duplicadas ni redundantes. Incluye estás palabras base: ${this.keywords}. Dejalas de primeras, y complétalas con términos relevantes que describan con precisión la imagen y su contexto.
  
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
    "description": "",
    "keywords": "",
    "categoryOne": value,
    "categoryTwo": value
  }

  🔁 Los valores de categoryOne y categoryTwo deben ser seleccionados del listado según el contenido visual.`;


  constructor(private readonly photoService: PhotoService) { }

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

  @Get('load-data')
  async loadDataPhotos() { }
}
