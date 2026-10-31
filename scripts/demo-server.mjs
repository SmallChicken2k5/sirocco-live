import { createStudio } from '../server.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const studio=await createStudio({dataDir:path.join(root,'data','demo-preview'),port:8766});
const response=await fetch('http://127.0.0.1:8766/api/demo',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
if(!response.ok){console.error(await response.text());await studio.close();process.exit(1);}
console.log('MINH HOẠ: http://127.0.0.1:8766 · cấu hình riêng, không thay thế link thật.');
const stop=async()=>{await studio.close();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
