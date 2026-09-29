import { Schema, model } from 'mongoose';
import { jsonOptions } from './shared';

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

jsonOptions(counterSchema);

export const CounterModel = model('Counter', counterSchema);
