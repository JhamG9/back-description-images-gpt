import { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export const PhotoSchema = new Schema({
  id: { type: String, default: () => uuidv4() }, // UUID generado automáticamente
  name: { type: String, required: true },
  title: {type: String, required: true},
  description: { type: String },
  keywords: { type: String }, // Almacena palabras clave separadas por comas
  sold: {type: Boolean, default: false},
  editorial: {type: Boolean, required: true}, // Indica si la foto es editorial o comercial
  categoryOne: { type: Number, required: false }, // ID de la categoría principal
  categoryTwo: { type: Number, required: false }, // ID de la categoría secundaria
});

export interface Photo extends Document {
  id: string;
  name: string;
  title: string;
  description: string;
  keywords: string;
  sold: boolean;
  editorial: boolean;
  categoryOne: number;
  categoryTwo: number;
}