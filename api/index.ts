import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as unknown as Parameters<typeof app>[0], res as unknown as Parameters<typeof app>[1]);
}
