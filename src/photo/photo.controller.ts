import { Controller, Post, Body, Get, Query, Put, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhotoService } from './photo.service';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

@Controller('photos')
export class PhotoController {
  private readonly openai: OpenAI;

  // Variables de desarrollo - cambiar aquí para hot reload
  isEditorial = false; // Si la foto es de tipo editorial o comercial
  removeEditorial = true; // Si es true, elimina ubicacion y fecha de descripciones editoriales
  folderPhotos = 'ia-test'; // fotos en la carpeta /public/
  keywords = 'coffe, colombian coffe, colombia'; // Palabras claves base
  place = 'Radual del Gayabero, Guaviare, Colombia'; // Lugar de las fotos  
  dateEditorial = 'May 1 2026';
  isIA = true;
  // dateEditorial = '';

  // additionalNotes = 'es una manguera tirando agua, entonces es importante incluir palabras relacionadas con agua y cuidado del agua, conservación, naturaleza, etc. para mejorar la relevancia en búsquedas relacionadas con esos temas.';
  additionalNotes = 'El barrio tiene forma de mariposa desde el aire con sus casas pintadas';
  private readonly categories = [
    { "label": "Animals/Wildlife", "value": 1 },
    { "label": "Arts", "value": 11 },
    { "label": "Backgrounds/Textures", "value": 3 },
    { "label": "Buildings/Landmarks", "value": 2 },
    { "label": "Business/Finance", "value": 4 },
    { "label": "Education", "value": 5 },
    { "label": "Food and drink", "value": 6 },
    { "label": "Healthcare/Medical", "value": 7 },
    { "label": "Holidays", "value": 8 },
    { "label": "Industrial", "value": 10 },
    { "label": "Nature", "value": 12 },
    { "label": "Objects", "value": 9 },
    { "label": "People", "value": 13 },
    { "label": "Religion", "value": 14 },
    { "label": "Science", "value": 15 },
    { "label": "Signs/Symbols", "value": 17 },
    { "label": "Sports/Recreation", "value": 18 },
    { "label": "Technology", "value": 16 },
    { "label": "Transportation", "value": 19 }
  ];

  private generateIAPrompt(): string {
    const descriptionFormat = `A natural and human description in English (maximum 200 characters), optimized for stock platforms such as Adobe Stock. Avoid generic phrases, promotional language, and repetitive structures typical of stock descriptions. Do not mention location, date, or any real-world reference.`;

    return `
The attached file is an AI-generated image.

Analyze the attached image and generate UNIQUE metadata based EXCLUSIVELY on visible elements.

CRITICAL RULES (MANDATORY):
- DO NOT assume information that is not clearly visible in the image.
- DO NOT reuse common stock description structures.
- Vary the syntactic structure of the description for each image — do not always follow the same sentence pattern.
- If an element is not clearly evident, DO NOT include it as a keyword.
- Avoid filler words and generic terms.
- Do not force keywords just to reach the target count.
- This is an AI-generated image. Do not include location, date, photographer, or any real-world reference in the description or keywords.

STRICT KEYWORD RULES:
- Use ONLY real, individual words commonly used in stock platforms.
- DO NOT combine words to create new compound terms.
- DO NOT invent words or merge concepts.
- DO NOT use long or artificial words.
- If a concept requires two words, split it into individual keywords (e.g., "animal", "conservation").
- Each keyword must stand alone as a valid search term.

Generate the following:

1. TITLE
- In English
- Short, precise, and factual
- Must include at least ONE specific and clearly visible visual detail (object, action, color, weather, perspective, time of day, or emotion).

2. DESCRIPTION
- ${descriptionFormat}
- Must mention at least TWO concrete visual details observable in the image.
- Use descriptive and natural language, not commercial.

3. KEYWORDS
- Between 45 and 50 keywords in English
- All lowercase
- No accents or special characters
- Separated by commas
- Use ONLY individual words (no compound phrases)
- No duplicates or redundant variations
- Ordered by relevance (most important first)
- Use these base keywords as contextual anchor for generation: ${this.keywords}
- Prioritize base keywords when they are visually consistent with the image
- Do not force unrelated base keywords if they are not visible

Keywords should cover, when relevant:
- visible physical elements
- actions or states
- environment and location
- concepts or emotions
- potential commercial or editorial uses

RESPONSE FORMAT:
Respond ONLY with valid JSON, no additional text, following EXACTLY this structure:

{
  "title": "",
  "description": "",
  "keywords": ""
}

Example of expected output:
{
  "title": "Roasted Coffee Beans in Ceramic Bowl at Morning Light",
  "description": "Dark roasted coffee beans fill a handmade ceramic bowl on a rustic wooden surface, lit by warm natural morning light.",
  "keywords": "coffee, beans, roasted, ceramic, bowl, wooden, rustic, morning, light, warm, dark, aroma, cafe, beverage, natural, texture, close, macro, brown, surface"
}

Any non-compliance with the above rules invalidates the response.
`;
  }

  private generatePrompt(isEditorial: boolean, isVideo: boolean): string {
    const descriptionFormat = isEditorial
      ? `An editorial description in English (maximum 200 characters). The format MUST be exactly: "${this.place} - ${this.dateEditorial} - [generated title]". Do not include opinions, interpretations, or assumptions.`
      : `A natural and human description in English (maximum 200 characters), optimized for stock platforms such as Shutterstock, Adobe Stock, and Alamy. Avoid generic phrases, promotional language, and repetitive structures typical of stock descriptions.`;

    const mediaInstruction = isVideo
      ? `You are analyzing a VIDEO through multiple frames extracted at different points in time. The frames are ordered chronologically (beginning -> middle -> end). Consider ALL frames to fully understand the video content, including actions, movements, and changes that occur throughout.`
      : `The attached file is a photograph.`;

    return `
${mediaInstruction}

Analyze ${isVideo ? 'all video frames' : 'the attached image'} and generate UNIQUE metadata based EXCLUSIVELY on visible elements.

CRITICAL RULES (MANDATORY):
- DO NOT assume information that is not clearly visible ${isVideo ? 'in the frames' : 'in the image'}.
- DO NOT reuse common stock description structures.
- Vary the syntactic structure of the description for each ${isVideo ? 'video' : 'image'} — do not always follow the same sentence pattern.
- If an element is not clearly evident, DO NOT include it as a keyword.
- Avoid filler words and generic terms.
- Do not force keywords just to reach the target count.
${isVideo ? '- For videos, include keywords related to movement, action, and the temporal sequence visible in the frames.' : ''}

STRICT KEYWORD RULES:
- Use ONLY real, individual words commonly used in stock platforms.
- DO NOT combine words to create new compound terms.
- DO NOT invent words or merge concepts.
- DO NOT use long or artificial words.
- If a concept requires two words, split it into individual keywords (e.g., "animal", "conservation").
- Each keyword must stand alone as a valid search term.

Generate the following:

1. TITLE
- In English
- Short, precise, and factual
- Must include at least ONE specific and clearly visible visual detail (object, action, color, weather, perspective, time of day, or emotion).

2. DESCRIPTION
- ${descriptionFormat}
- Must mention at least TWO concrete visual details observable in the ${isVideo ? 'video' : 'image'}.
- Use descriptive and natural language, not commercial.

3. KEYWORDS
- Between 45 and 50 keywords in English
- All lowercase
- No accents or special characters
- Separated by commas
- Use ONLY individual words (no compound phrases)
- No duplicates or redundant variations
- Ordered by relevance (most important first)
- Must include the following words: ${this.keywords}

Keywords should cover, when relevant:
- visible physical elements
- actions or states
- environment and location
- concepts or emotions
- potential commercial or editorial uses

Reference location: ${this.place}

4. CATEGORIES
Select:
- categoryOne (primary)
- categoryTwo (secondary)

Use EXCLUSIVELY the numeric values from the following list, based on the predominant visual subject:

${JSON.stringify(this.categories, null, 2)}

${this.additionalNotes ? `Additional notes: ${this.additionalNotes}` : ''}

RESPONSE FORMAT:
Respond ONLY with valid JSON, no additional text, following EXACTLY this structure:

{
  "title": "",
  "description": "",
  "keywords": "",
  "categoryOne": value,
  "categoryTwo": value
}

Example of expected output:
{
  "title": "Aerial View of Green Amazon Rainforest at Sunrise",
  "description": "Dense tropical forest canopy stretching across the horizon under golden morning light in the Colombian Amazon.",
  "keywords": "amazon, rainforest, aerial, canopy, tropical, forest, sunrise, green, colombia, nature, jungle, biodiversity, environment, landscape, morning, light, trees, wilderness, ecosystem, conservation",
  "categoryOne": 12,
  "categoryTwo": 5
}

Any non-compliance with the above rules invalidates the response.
`;
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
      const normalizeEditorialDescription = (value?: string) => {
        if (!value) {
          return value;
        }

        const parts = value.split(' - ');
        if (parts.length >= 3) {
          return parts.slice(2).join(' - ').trim();
        }

        return value;
      };

      const toPlainObject = (item: any) => {
        if (item && typeof item.toObject === 'function') {
          return item.toObject();
        }

        return item;
      };

      return data.map((item: any) => {
        const plainItem = toPlainObject(item);

        return {
          ...plainItem,
          description: this.removeEditorial
            ? normalizeEditorialDescription(plainItem.description)
            : plainItem.description,
          editorial: this.removeEditorial ? false : plainItem.editorial,
          };

      });
    } else {
      const filePath = `./public/${this.folderPhotos}/${name}`;
      const isVideo = name.toLowerCase().endsWith('.mp4');

      console.log(`Procesando archivo: ${name}`);
      console.log(`Es video: ${isVideo}`);
      console.log(`Path completo: ${filePath}`);

      let messageContent: any[] = [];

      if (isVideo) {
        // Si es video, extraer múltiples frames
        console.log('Extrayendo múltiples frames del video...');
        const framePaths = await this.photoService.extractVideoFrames(filePath, 5);

        // Agregar texto explicativo
        messageContent.push({
          type: 'text',
          text: this.isIA ? this.generateIAPrompt() : this.generatePrompt(this.isEditorial, isVideo),
        });

        // Agregar contexto de que son frames secuenciales
        messageContent.push({
          type: 'text',
          text: `Las siguientes 5 imágenes son frames extraídos del MISMO VIDEO en orden cronológico (inicio, medio y final). Analiza todos los frames para generar metadata completa del video:`,
        });

        // Convertir y agregar cada frame
        for (let i = 0; i < framePaths.length; i++) {
          const base64Frame = await this.photoService.convertImageToBase64(framePaths[i]);
          messageContent.push({
            type: 'text',
            text: `Frame ${i + 1} de ${framePaths.length}:`,
          });
          messageContent.push({
            type: 'image_url',
            image_url: { url: base64Frame },
          });
        }
      } else {
        // Si es imagen, comprimir normalmente
        console.log('Comprimiendo imagen...');
        const compressedPath = await this.photoService.compressImage(filePath);
        const base64Image = await this.photoService.convertImageToBase64(compressedPath);

        messageContent = [
          {
            type: 'text',
            text: this.isIA ? this.generateIAPrompt() : this.generatePrompt(this.isEditorial, isVideo),
          },
          {
            type: 'image_url',
            image_url: { url: base64Image },
          },
        ];
      }

      const completion: any = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: messageContent,
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
        categoryTwo,
        editorial: this.isEditorial,
        isIA: this.isIA ? true : null,
      });
      return [dataSaved];
    }
  }

  @Put('sold/:id')
  async markAsSold(@Param('id') id: string) {
    return this.photoService.markAsSold(id);
  }

  @Get('load-data')
  async loadDataPhotos() {
    const folderPath = path.resolve(`./public/${this.folderPhotos}`);

    if (!fs.existsSync(folderPath)) {
      return {
        status: 'error',
        message: `No existe la carpeta: ${folderPath}`,
      };
    }

    const files = await fs.promises.readdir(folderPath);
    const mediaFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp', '.mp4'].includes(ext);
    });

    for (const fileName of mediaFiles) {
      await this.findByName(fileName);
    }

    return {
      status: 'success',
      message: `Se procesaron ${mediaFiles.length} archivos`,
      total: mediaFiles.length,
    };
  }

  @Get('test-config')
  async getDataTest() {
    return {
      status: 'success',
      message: 'Environment variables loaded successfully',
      config: {
        isEditorial: this.isEditorial,
        folderPhotos: this.folderPhotos,
        place: this.place,
        dateEditorial: this.dateEditorial,
        keywords: this.keywords,
        hasOpenAIKey: !!this.configService.get<string>('OPENAI_API_KEY'),
        openAIKeyLength: this.configService.get<string>('OPENAI_API_KEY')?.length || 0,
      },
      timestamp: new Date().toISOString()
    };
  }
}