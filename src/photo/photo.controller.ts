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
  folderPhotos = 'guajira'; // fotos en la carpeta /public/sachica
  keywords =
    'la guajira, la guajira colombia, la guajira tourism, colombia tourism, colombia, vacations in colombia, tourism'; // Palabras claves base
  place = 'La Guajira, Colombia'; // Lugar de las fotos
  promptAntiguo = `Genera un título en inglés describiendo lo que hay en la imagen adjunta, con una extensión máxima de 200 caracteres para Shutterstock y Adobe Stock. La ubicación del lugar es: ${this.place}. Proporciona exactamente 50 palabras clave en inglés en un solo párrafo, separadas por comas, sin tildes y todas en minúsculas. Usa las siguientes palabras clave y asegúrate de que cada una esté separada por comas, incluso las que tu agregues: ${this.keywords}. Busca imágenes relacionadas a la imagen en la web para mejorar las palabras clave para Shutterstock y Adobe Stock. Usa palabras sencillas y fáciles de leer. Asegúrate de que todas las palabras clave estén separadas por comas y si es necesario agrega palabras para completar las 50 palabras claves. Tómate tu tiempo en hacerlo y asegúrate de que la respuesta sea precisa y exacta. Tambien quiero la respuesta en formato json, solo dame el json osea la respuesta inicia con un { y cierra con un }, y debe de ser esta estructura: {title: '', keywords: ''}`;
  prompt = `Analiza la imagen adjunta y genera: 
  1️⃣ Un título en inglés (máximo 200 caracteres) que describa claramente la escena, optimizado para Shutterstock y Adobe Stock.
  2️⃣ 50 palabras clave en inglés, separadas por comas, sin tildes y en minúsculas. Incluye estas palabras base: ${this.keywords}. Completa con términos relevantes según la imagen y palabras claves base.  
  
  📌 Ubicación: ${this.place}.
  🔎 Usa referencias visuales para mejorar la precisión de palabras clave y recuerda que son 50 palabras claves.

  📌 Responde **solo en formato JSON** con la estructura:  
  { "title": "", "keywords": "" } y recuerda que son 50 palabras claves o 50 keywords, y cada keyword es separada por comas (,)`;

  // EDITORIAL
  dateEditorial = 'August 14 2023';
  promptEditorial = `Genera un título en inglés describiendo lo que hay en la imagen adjunta, con una extensión máxima de 200 caracteres para Shutterstock y Adobe Stock. Tambien es para uso editorial por lo cual el formato es: "${this.place} - ${this.dateEditorial} - Titulo a generar" La ubicación del lugar es: ${this.place}. Proporciona exactamente 50 palabras clave en inglés en un solo párrafo, separadas por comas, sin tildes y todas en minúsculas. Usa las siguientes palabras clave y asegúrate de que cada una esté separada por comas, incluso las que tu agregues: ${this.keywords}. Busca imágenes relacionadas a la imagen en la web para mejorar las palabras clave para Shutterstock y Adobe Stock. Usa palabras sencillas y fáciles de leer. Asegúrate de que todas las palabras clave estén separadas por comas y si es necesario agrega palabras para completar las 50 palabras claves. Tómate tu tiempo en hacerlo y asegúrate de que la respuesta sea precisa y exacta. Tambien quiero la respuesta en formato json, solo dame el json osea la respuesta inicia con un { y cierra con un }, y debe de ser esta estructura: {title: '', keywords: ''}`;

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

      console.log(completion);

      const { title, keywords } =
        this.photoService.extractTitleAndKeywords(dataResponse);

      const dataSaved = await this.photoService.create({
        name,
        description: title,
        keywords,
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
