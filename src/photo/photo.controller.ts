import {
  BadRequestException,
  Body,
  Controller,
  Get,
  ConflictException,
  NotFoundException,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { PhotoService } from './photo.service';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import {
  GenerationConfig,
  PLATFORMS_WITHOUT_EDITORIAL,
  SearchRequest,
} from './photo.types';

// multer viene incluido con @nestjs/platform-express
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multer = require('multer');

const PUBLIC_DIR = path.resolve('./public');
const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.mp4'];
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB (videos)

/**
 * multer decodifica el nombre como latin1; lo pasamos a UTF-8 para que los
 * nombres con tildes queden igual que el original (la extensión busca por nombre).
 */
const uploadName = (file: { originalname: string }) =>
  path.basename(Buffer.from(file.originalname, 'latin1').toString('utf8'));

const uploadOptions = {
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = uploadName(file);
    if (!MEDIA_EXTENSIONS.includes(path.extname(name).toLowerCase())) {
      return cb(new BadRequestException(`Tipo de archivo no permitido: ${name}`), false);
    }
    // Nunca sobrescribe: si ya existe, se avisa
    if (fs.existsSync(path.join(PUBLIC_DIR, name))) {
      return cb(new ConflictException(`${name} ya existe en /public`), false);
    }
    cb(null, true);
  },
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
      cb(null, PUBLIC_DIR);
    },
    filename: (_req, file, cb) => cb(null, uploadName(file)),
  }),
};

@Controller('photos')
export class PhotoController {
  private readonly openai: OpenAI;

  // Modelo de visión configurable desde .env (OPENAI_MODEL)
  private readonly model: string;

  // Adobe Stock acepta máximo 49 keywords; el resto 50. Usamos 49 para todos.
  private readonly maxKeywords = 49;
  // Mínimo bajo a propósito: pedir muchas keywords hace que el modelo
  // rellene con palabras que no se ven (summer, wildlife, adventure…).
  private readonly minKeywords = 30;

  private readonly categories = [
    { label: 'Animals/Wildlife', value: 1 },
    { label: 'Arts', value: 11 },
    { label: 'Backgrounds/Textures', value: 3 },
    { label: 'Buildings/Landmarks', value: 2 },
    { label: 'Business/Finance', value: 4 },
    { label: 'Education', value: 5 },
    { label: 'Food and drink', value: 6 },
    { label: 'Healthcare/Medical', value: 7 },
    { label: 'Holidays', value: 8 },
    { label: 'Industrial', value: 10 },
    { label: 'Nature', value: 12 },
    { label: 'Objects', value: 9 },
    { label: 'People', value: 13 },
    { label: 'Religion', value: 14 },
    { label: 'Science', value: 15 },
    { label: 'Signs/Symbols', value: 17 },
    { label: 'Sports/Recreation', value: 18 },
    { label: 'Technology', value: 16 },
    { label: 'Transportation', value: 19 },
  ];

  private readonly keywordRules = `KEYWORD RULES:
- THE BUYER TEST: include a keyword only if a buyer who searches that exact term would be happy to find THIS image. If not, leave it out.
- Use real search terms that buyers actually type on stock platforms.
- Each keyword is either a single word OR a common two-word phrase (e.g., "coffee beans", "aerial view", "cloud forest"). Never more than two words.
- Use a two-word phrase only when it is an established search term; otherwise use single words.
- DO NOT invent words or merge words into new compound terms.
- Every keyword must appear only ONCE. Before answering, check the list for repeats.
- No near-duplicates: singular/plural ("hill", "hills"), noun/adjective of the same root ("nature", "natural"; "ecology", "ecological"; "panorama", "panoramic"; "scenery", "scenic"). Keep only the most searched form.

NEVER INCLUDE (common mistakes):
- Seasons ("summer", "winter", "spring", "autumn") unless snow, autumn leaves or another season marker is clearly visible. Many places (e.g., the Andes, the equator) have no seasons.
- Animals or "wildlife" unless an animal is clearly visible. People-related words ("tourist", "hiker", "travelers") unless a person is clearly visible.
- Activities that are not happening in the image ("hiking", "adventure", "exploration", "camping") unless people, gear or a trail being used are visible.
- Empty adjectives and filler: beauty, beautiful, freshness, picturesque, stunning, breathtaking, amazing, unique, view, scenery, wonderful, idyllic.
- Weather or time of day you cannot clearly see.

ORDER: first the base keywords, then the main visible subjects, then setting, colors, light and composition (e.g., "aerial view", "no people"), and at the end at most 5 concepts that the image clearly conveys (e.g., "tranquility", "conservation").`;

  constructor(
    private readonly photoService: PhotoService,
    private readonly configService: ConfigService,
  ) {
    this.model =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4.1-mini';
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  // ---------------------------------------------------------------------------
  // Endpoints
  // ---------------------------------------------------------------------------

  @Post()
  async create(
    @Body() photoDto: { name: string; description?: string; keywords?: string },
  ) {
    return this.photoService.create(photoDto);
  }

  /** Solo consulta: devuelve la foto si ya fue generada. */
  @Get('search')
  async findByName(
    @Query('name') name: string,
    @Query('platform') platform?: string,
  ) {
    const stored = await this.photoService.findByName(name);
    if (stored.length === 0) {
      throw new NotFoundException(
        `${name} no ha sido generada. Usa POST /photos/search con la configuración.`,
      );
    }
    return stored.map((item) => this.adaptForPlatform(item, platform));
  }

  /**
   * Lo que usa la extensión al hacer clic: devuelve la foto guardada o, si no
   * existe, la genera con la configuración enviada desde el popup.
   */
  @Post('search')
  async search(@Body() body: SearchRequest) {
    const { name, platform, config } = body ?? ({} as SearchRequest);
    if (!name) {
      throw new BadRequestException('Falta el nombre del archivo');
    }

    const stored = await this.photoService.findByName(name);
    if (stored.length > 0) {
      return stored.map((item) => this.adaptForPlatform(item, platform));
    }

    const saved = await this.generate(name, this.validateConfig(config));
    return [this.adaptForPlatform(saved, platform)];
  }

  /**
   * Sube un archivo a /public (uno por petición, para mostrar progreso por
   * archivo). Si `generate` es "true", genera los metadatos en el momento con
   * la configuración enviada (JSON en el campo `config`).
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async upload(
    @UploadedFile() file: any,
    @Body() body: { generate?: string; config?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No llegó ningún archivo');
    }
    const name = file.filename;

    if (body?.generate !== 'true') {
      return { name, uploaded: true, generated: false };
    }

    let config: GenerationConfig | undefined;
    try {
      config = body.config ? JSON.parse(body.config) : undefined;
    } catch {
      throw new BadRequestException('La configuración no es JSON válido');
    }

    // Si la generación falla, el archivo ya quedó subido: se informa sin borrarlo
    try {
      const existing = await this.photoService.findByName(name);
      const photo = existing.length > 0
        ? existing[0]
        : await this.generate(name, this.validateConfig(config));
      return { name, uploaded: true, generated: true, title: photo.title };
    } catch (error) {
      return { name, uploaded: true, generated: false, error: error.message };
    }
  }

  /** Genera de una vez todos los archivos que están en /public. */
  @Post('load-data')
  async loadDataPhotos(@Body() body: { config?: GenerationConfig }) {
    const config = this.validateConfig(body?.config);
    const entries = await fs.promises.readdir(PUBLIC_DIR, { withFileTypes: true });
    const mediaFiles = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((file) => MEDIA_EXTENSIONS.includes(path.extname(file).toLowerCase()));

    // Un archivo que falle no detiene el resto del lote
    const failed: { file: string; error: string }[] = [];
    let skipped = 0;
    for (const fileName of mediaFiles) {
      try {
        const stored = await this.photoService.findByName(fileName);
        if (stored.length > 0) {
          skipped++;
          continue;
        }
        await this.generate(fileName, config);
      } catch (error) {
        console.error(`Error procesando ${fileName}:`, error.message);
        failed.push({ file: fileName, error: error.message });
      }
    }

    return {
      status: failed.length === 0 ? 'success' : 'partial',
      message: `Se procesaron ${mediaFiles.length - failed.length} de ${mediaFiles.length} archivos (${skipped} ya existían)`,
      total: mediaFiles.length,
      skipped,
      failed,
    };
  }

  /** Estado del backend (lo usa el popup para mostrar si está conectado). */
  @Get('test-config')
  async getDataTest() {
    return {
      status: 'success',
      model: this.model,
      hasOpenAIKey: !!this.configService.get<string>('OPENAI_API_KEY'),
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Generación
  // ---------------------------------------------------------------------------

  private async generate(name: string, config: GenerationConfig) {
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      throw new BadRequestException(`Nombre de archivo inválido: ${name}`);
    }

    const filePath = path.join(PUBLIC_DIR, name);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`No encontré ${name} en /public.`);
    }

    const isVideo = name.toLowerCase().endsWith('.mp4');
    console.log(`Generando ${name} (${isVideo ? 'video' : 'foto'})`);

    const prompt = this.generatePrompt(config, isVideo);
    let messageContent: any[];

    if (isVideo) {
      const framePaths = await this.photoService.extractVideoFrames(filePath, 5);
      messageContent = [
        { type: 'text', text: prompt },
        {
          type: 'text',
          text: `The following ${framePaths.length} images are frames from the SAME VIDEO in chronological order (beginning, middle, end). Use all of them to generate metadata for the whole video:`,
        },
      ];
      for (let i = 0; i < framePaths.length; i++) {
        const base64Frame = await this.photoService.convertImageToBase64(framePaths[i]);
        messageContent.push({ type: 'text', text: `Frame ${i + 1} of ${framePaths.length}:` });
        messageContent.push({ type: 'image_url', image_url: { url: base64Frame } });
      }
    } else {
      const compressedPath = await this.photoService.compressImage(filePath);
      const base64Image = await this.photoService.convertImageToBase64(compressedPath);
      messageContent = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: base64Image, detail: 'high' } },
      ];
    }

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: messageContent }],
      response_format: this.buildResponseSchema(),
    });
    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      throw new Error(`El modelo rechazó ${name}: ${message.refusal}`);
    }

    const metadata = this.photoService.parseMetadata(message?.content, name);

    // Normaliza en código: minúsculas, sin tildes, sin duplicados,
    // keywords base primero y máximo 49.
    const keywords = this.photoService.normalizeKeywords(
      metadata.keywords,
      config.keywords.split(','),
      this.maxKeywords,
    );

    console.log({ name, title: metadata.title, keywords });

    return this.photoService.create({
      name,
      title: metadata.title,
      description: metadata.description,
      keywords,
      categoryOne: metadata.categoryOne,
      categoryTwo: metadata.categoryTwo,
      editorial: config.editorial,
    });
  }

  private generatePrompt(config: GenerationConfig, isVideo: boolean): string {
    const descriptionFormat = config.editorial
      ? `An editorial description in English (maximum 200 characters). The format MUST be exactly: "${config.place} - ${config.date} - [factual sentence describing what is visible]". Do not include opinions, interpretations, or assumptions.`
      : `A natural and human description in English (maximum 200 characters), optimized for stock platforms such as Shutterstock, Adobe Stock, and Alamy.`;

    const location = config.place
      ? `LOCATION (given by the photographer, trust it): ${config.place}
- Use it to name the place correctly in the title and description.
- Write place names with their correct local spelling and accents exactly as given here or in the base keywords (e.g., "Páramo", "Bogotá", "Baños", "Quilotoa"). Never move or invent accents.`
      : `- Write any place name with its correct local spelling exactly as it appears in the base keywords. Never invent accents.`;

    const mediaInstruction = isVideo
      ? `You are analyzing a VIDEO through multiple frames extracted at different points in time. The frames are ordered chronologically (beginning -> middle -> end). Consider ALL frames to fully understand the video content, including actions, movements, and changes that occur throughout.`
      : `The attached file is a photograph.`;

    return `
${mediaInstruction}

Analyze ${isVideo ? 'all video frames' : 'the attached image'} and generate UNIQUE metadata based EXCLUSIVELY on visible elements.

CRITICAL RULES (MANDATORY):
- DO NOT assume information that is not clearly visible ${isVideo ? 'in the frames' : 'in the image'}.
- Vary the sentence structure of the description — do not always follow the same pattern.
${isVideo ? '- For videos, include keywords related to movement, action, and the temporal sequence visible in the frames.' : ''}

${location}

${this.keywordRules}

Generate the following:

1. TITLE
- In English, short, precise, and factual (maximum 70 characters).
- Must include at least ONE specific and clearly visible visual detail (object, action, color, weather, perspective, or time of day).
- Before answering, check the spelling of every word, especially place names.

2. DESCRIPTION
- ${descriptionFormat}
- Must mention at least TWO concrete visual details observable in the ${isVideo ? 'video' : 'image'}.
- Plain, factual language. Never use: showcasing, showcases, captures, nestled, stunning, breathtaking, unique, beautiful, perfect, majestic.

3. KEYWORDS
- Between ${this.minKeywords} and ${this.maxKeywords} keywords in English, counting the base keywords. Quality over quantity: if only ${this.minKeywords} pass the buyer test, return ${this.minKeywords}.
- All lowercase, no accents or special characters, separated by commas.
- Start with these base keywords exactly as written (they may be multi-word place names; this is the only exception to the two-word limit): ${config.keywords || '(none)'}

4. CATEGORIES
- categoryOne: the category of the main visible subject.
- categoryTwo: a DIFFERENT category that also clearly applies to what is visible (e.g., a landscape with a road → Nature + Transportation; a church in a plaza → Buildings/Landmarks + Religion). For pure landscapes with nothing else, use Nature + Backgrounds/Textures.
- NEVER choose Education, Science, Business/Finance, Healthcare/Medical, Technology or Holidays unless the image explicitly shows that theme (a classroom, a lab, money, a hospital, devices, a festivity).
- Use EXCLUSIVELY the numeric values from this list:
${this.categories.map((c) => `  ${c.value} = ${c.label}`).join('\n')}

${config.notes ? `PHOTOGRAPHER NOTES (context you can trust): ${config.notes}` : ''}
`;
  }

  private buildResponseSchema() {
    const values = this.categories.map((c) => c.value);
    const properties = {
      title: { type: 'string' },
      description: { type: 'string' },
      keywords: {
        type: 'string',
        description: 'Comma-separated keywords, most relevant first',
      },
      categoryOne: { type: 'integer', enum: values },
      categoryTwo: { type: 'integer', enum: values },
    };

    return {
      type: 'json_schema' as const,
      json_schema: {
        name: 'stock_metadata',
        strict: true,
        schema: {
          type: 'object',
          properties,
          required: Object.keys(properties),
          additionalProperties: false,
        },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private validateConfig(config?: GenerationConfig): GenerationConfig {
    if (!config) {
      throw new BadRequestException(
        'Falta la configuración. Ábrela en el popup de la extensión.',
      );
    }

    const editorial = !!config.editorial;
    const place = config.place?.trim() ?? '';
    const date = config.date?.trim() ?? '';
    if (editorial && (!place || !date)) {
      throw new BadRequestException('Para fotos editoriales el lugar y la fecha son obligatorios.');
    }

    return {
      keywords: config.keywords?.trim() ?? '',
      editorial,
      place,
      date,
      notes: config.notes?.trim() ?? '',
    };
  }

  /**
   * Adapta lo guardado a la plataforma que pregunta: en las que no marcan
   * editorial se quita "lugar - fecha - " de la descripción.
   */
  private adaptForPlatform(item: any, platform?: string) {
    const plain = typeof item?.toObject === 'function' ? item.toObject() : item;
    if (!plain.editorial || !platform || !PLATFORMS_WITHOUT_EDITORIAL.has(platform)) {
      return plain;
    }

    const parts = (plain.description ?? '').split(' - ');
    return {
      ...plain,
      description: parts.length >= 3 ? parts.slice(2).join(' - ').trim() : plain.description,
      editorial: false,
    };
  }
}
