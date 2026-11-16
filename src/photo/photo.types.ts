/**
 * Configuración que envía la extensión (desde el popup) en cada petición.
 * Solo se usa cuando la foto todavía no existe en la base de datos.
 */
export interface GenerationConfig {
  keywords: string; // keywords base separadas por comas
  editorial: boolean;
  place?: string; // obligatorio si editorial
  date?: string; // obligatorio si editorial
  notes?: string; // contexto adicional para la IA
}

export interface SearchRequest {
  name: string;
  platform?: string; // clave de la extensión: ADOBE_STOCK, ALAMY, ...
  config?: GenerationConfig;
}

/**
 * Plataformas donde la extensión no marca la foto como editorial.
 * En ellas se quita "lugar - fecha - " de la descripción y se responde
 * editorial: false. El resto (Shutterstock, Alamy, Dreamstime,
 * DepositPhotos) recibe la descripción editorial completa.
 */
export const PLATFORMS_WITHOUT_EDITORIAL = new Set([
  'ADOBE_STOCK',
  'GETTY_IMAGES',
  'POND5',
]);
