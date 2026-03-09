/**
 * Charge .env.local / .env AVANT tout autre import.
 * À importer en premier dans les scripts.
 */
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

for (const name of ['.env.local', '.env']) {
  const envPath = path.resolve(projectRoot, name);
  console.log('Chemin du .env lu :', envPath);

  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'));
    console.log('Nombre de lignes (sans vides/commentaires) :', lines.length);
    console.log("Contient 'SUPABASE' :", raw.includes('SUPABASE'));
  } else {
    console.log('Fichier absent');
  }

  const result = dotenv.config({ path: envPath });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    break;
  }
}
