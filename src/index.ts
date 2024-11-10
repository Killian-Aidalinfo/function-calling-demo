import { Hono } from 'hono';
import { ExtractorFunction } from './controllers/ExtractorImage';

const app = new Hono();

app.get('/status', (c) => {
  return c.text('Ready 🔥🔥🔥')
});

app.post('/upload', ...ExtractorFunction);

export default {
  port: 4000,
  fetch: app.fetch
}