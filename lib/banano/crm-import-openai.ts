import OpenAI from 'openai';
import { z } from 'zod';

const responseSchema = z.object({
  phoneHeader: z.string(),
  firstNameHeader: z.string().nullable().optional(),
  lastNameHeader: z.string().nullable().optional(),
  fullNameHeader: z.string().nullable().optional(),
  pointsBalanceHeader: z.string().nullable().optional(),
  stampsBalanceHeader: z.string().nullable().optional(),
  narrative: z.string().max(500).optional(),
});

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export async function aiMapCrmImportColumns(args: {
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  loyaltyMode: 'points' | 'stamps';
}): Promise<z.infer<typeof responseSchema> | null> {
  const openai = getClient();
  if (!openai) return null;

  const headerLine = JSON.stringify(args.headers);
  const sample = JSON.stringify(args.sampleRows.slice(0, 12));

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Tu aides à migrer une base clients vers REPUTEXA (fidélité).',
            'Tu reçois les en-têtes de colonnes et quelques lignes d’un export (Excel/CSV/caisse).',
            'Réponds UNIQUEMENT par un objet JSON avec les clés :',
            'phoneHeader (string, obligatoire — libellé EXACT d’une colonne de la liste des en-têtes),',
            'firstNameHeader, lastNameHeader, fullNameHeader (nullable si absent),',
            'pointsBalanceHeader, stampsBalanceHeader (nullable si absent),',
            'narrative (string courte en français, ton pro et rassurant, 1 phrase : ce que tu as reconnu et le nombre total de lignes).',
            `Mode fidélité du commerce : ${args.loyaltyMode} (points ou tampons).`,
            'Règles : phoneHeader doit être la colonne des numéros mobiles FR ou internationaux.',
            'Si prénom et nom sont séparés, remplis firstNameHeader et lastNameHeader et mets fullNameHeader à null.',
            'Si un seul libellé regroupe le nom, utilise fullNameHeader.',
            'Pour les soldes : si une seule colonne "solde" et mode points, mets-la dans pointsBalanceHeader.',
            'Les en-têtes dans ta réponse doivent correspondre EXACTEMENT (casse incluse) à l’un des éléments du tableau headers.',
            `Il y a ${args.totalRows} lignes de données (approximatif).`,
          ].join('\n'),
        },
        {
          role: 'user',
          content: `headers: ${headerLine}\nsampleRows: ${sample}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const out = responseSchema.safeParse(parsed);
    if (!out.success) return null;
    if (!args.headers.includes(out.data.phoneHeader)) {
      const lower = out.data.phoneHeader.toLowerCase();
      const fuzz = args.headers.find((h) => h.toLowerCase() === lower);
      if (fuzz) out.data.phoneHeader = fuzz;
      else return null;
    }
    return out.data;
  } catch {
    return null;
  }
}
