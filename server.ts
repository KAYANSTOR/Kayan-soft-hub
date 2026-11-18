import { createApp } from './src/server/app.js';
import { hubRepository } from './src/server/repositories/hubRepository.js';

await hubRepository.initialize();

const port = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(port, '0.0.0.0', () => {
  console.log(`Kayan Soft Hub running on http://0.0.0.0:${port}`);
});
