import { createApp } from '../src/server/app.js';
import { hubRepository } from '../src/server/repositories/hubRepository.js';

await hubRepository.initialize();

export default createApp();
