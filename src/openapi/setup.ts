import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

let extended = false;

if (!extended) {
  extendZodWithOpenApi(z);
  extended = true;
}

export { z };
