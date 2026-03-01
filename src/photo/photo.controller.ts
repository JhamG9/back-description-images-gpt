import { Controller, Post, Body, Get, Query, Put, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhotoService } from './photo.service';
import OpenAI from 'openai';

@Controller('photos')
export class PhotoController {
  private readonly openai: OpenAI;

  // Variables de desarrollo - cambiar aquí para hot reload
  isEditorial = false; // Si la foto es de tipo editorial o comercial
  folderPhotos = 'aguaclara'; // fotos en la carpeta /public/
  keywords = 'agua clara buenaventura, buenaventura, valle del cauca, colombia'; // Palabras claves base
  place = 'Agua Clara, Buenaventura, Valle del Cauca, Colombia'; // Lugar de las fotos  
  dateEditorial = 'January 12 2026';

  notesVideo = ''
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

  private generatePrompt(isEditorial: boolean, isVideo: boolean): string {
    const descriptionFormat = isEditorial
      ? `Una descripción editorial en inglés (máximo 200 caracteres). El formato DEBE ser exactamente: "${this.place} - ${this.dateEditorial} - [titulo generado]". No incluyas opiniones, interpretaciones ni suposiciones.`
      : `Una descripción natural y humana en inglés (máximo 200 caracteres), optimizada para bancos de imágenes como Shutterstock, Adobe Stock y Alamy. Evita frases genéricas, lenguaje publicitario y estructuras repetidas típicas de stock.`;

    const mediaInstruction = isVideo
      ? `Estás analizando un VIDEO a través de múltiples frames extraídos en diferentes momentos temporales. Los frames están ordenados cronológicamente (inicio → medio → final). Considera TODOS los frames para entender el contenido completo del video, las acciones, movimientos y cambios que ocurren a lo largo del tiempo.`
      : `La imagen adjunta es una fotografía.`;
    return `
    ${mediaInstruction}

Analiza ${isVideo ? 'todos los frames del video' : 'la imagen adjunta'} y genera metadata ÚNICA basándote EXCLUSIVAMENTE en los elementos visibles.

🚨 REGLAS CRÍTICAS (OBLIGATORIAS):
- NO asumas información que no sea claramente visible ${isVideo ? 'en los frames' : 'en la imagen'}.
- NO repitas estructuras de texto comunes en descripciones de stock.
- Cada ${isVideo ? 'video' : 'imagen'} debe parecer escrito por una persona diferente.
- Si un elemento no es evidente, NO lo incluyas como keyword.
- Evita palabras de relleno y términos genéricos.
- No fuerces información solo para completar el número de keywords.
${isVideo ? '- Para videos, incluye keywords relacionadas con el movimiento, acción y secuencia temporal visible en los frames.' : ''}

🚫 REGLAS ESTRICTAS PARA KEYWORDS:
- Usa SOLO palabras individuales reales y comunes en bancos de imágenes.
- NO combines palabras para crear términos nuevos.
- NO inventes palabras ni fusiones conceptos.
- NO uses palabras largas o artificiales.
- Si un concepto requiere dos palabras, sepáralo en keywords individuales
  (ejemplo: "animal", "conservation").
- Cada keyword debe poder existir por sí sola como término de búsqueda válido.

Genera lo siguiente:

1️⃣ TÍTULO
- En inglés
- Breve, preciso y factual
- Debe incluir al menos UN detalle visual específico y claramente visible
  (objeto, acción, color, clima, perspectiva, hora del día o emoción).

2️⃣ DESCRIPCIÓN
- ${descriptionFormat}
- Debe mencionar al menos DOS detalles visuales concretos observables en la imagen.
- Usa lenguaje descriptivo y natural, no comercial.

3️⃣ KEYWORDS
- Exactamente 50 palabras clave en inglés
- Todas en minúsculas
- Sin tildes
- Separadas por comas
- Usa SOLO palabras individuales (no frases compuestas)
- No incluyas duplicados ni variaciones redundantes
- Ordénalas por relevancia (las más importantes primero)
- Incluye obligatoriamente con estas palabras: ${this.keywords}

Las keywords deben cubrir, cuando sea relevante:
- elementos físicos visibles
- acciones o estados
- entorno y ubicación
- conceptos o emociones
- posibles usos comerciales o editoriales

📍 Ubicación de referencia: ${this.place}

4️⃣ CATEGORÍAS
Selecciona:
- categoryOne (principal)
- categoryTwo (secundaria)

Usa EXCLUSIVAMENTE los valores numéricos de la siguiente lista, según el sujeto visual predominante:

${JSON.stringify(this.categories, null, 2)}

📌 FORMATO DE RESPUESTA:
Responde ÚNICAMENTE con un JSON válido, sin texto adicional, siguiendo EXACTAMENTE esta estructura:

{
  "title": "",
  "description": "",
  "keywords": "",
  "categoryOne": value,
  "categoryTwo": value
}

Cualquier incumplimiento de las reglas anteriores invalida la respuesta.
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
      return data;
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
          text: this.generatePrompt(this.isEditorial, isVideo),
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
            text: this.generatePrompt(this.isEditorial, isVideo),
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
        editorial: this.isEditorial
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