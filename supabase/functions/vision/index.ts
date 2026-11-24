
import Anthropic from 'npm:@anthropic-ai/sdk';

// Buzzcook "vision": reads one photo with Claude and returns JSON.
//   kind "receipt": the food lines of a shop receipt, as products for the fridge.
//   kind "dish":    a rough calorie and macro estimate of a plate of food (a draft the person corrects).
//
// Deploy: Supabase → Edge Functions → Deploy a new function → name it "vision" → paste this file.
// Then turn OFF "Verify JWT" for it (the app calls it with the publishable key), and add the secret
// ANTHROPIC_API_KEY in Edge Functions → Secrets. The key never goes into the app.
const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const MODEL = 'claude-opus-5-5';
const MAX_IMAGE = 5_000_000; // base64 characters; the API takes images up to 5 MB

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const RECEIPT = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['line', 'name', 'match', 'qty', 'unit', 'food'],
        properties: {
          line: { type: 'string', description: 'the receipt line as printed' },
          name: { type: 'string', description: 'plain Ukrainian product name, lowercase, no brand or percent, e.g. "грецький йогурт"' },
          match: { type: 'string', description: 'the closest name from the known list, or "" if none fits' },
          qty: { type: 'number', description: 'amount bought in the unit below; pack weight times count when the pack size is printed' },
          unit: { type: 'string', enum: ['г', 'мл', 'шт'] },
          food: { type: 'boolean', description: 'false for bags, household goods, deposits, discounts' },
        },
      },
    },
  },
};

const DISH = {
  type: 'object',
  additionalProperties: false,
  required: ['food', 'name', 'grams', 'kcal', 'p', 'f', 'c', 'sure', 'note'],
  properties: {
    food: { type: 'boolean', description: 'false if the photo shows no food' },
    name: { type: 'string', description: 'short Ukrainian dish name, lowercase' },
    grams: { type: 'number', description: 'estimated weight of everything on the plate' },
    kcal: { type: 'number' },
    p: { type: 'number', description: 'protein, g' },
    f: { type: 'number', description: 'fat, g' },
    c: { type: 'number', description: 'carbs, g' },
    sure: { type: 'string', enum: ['low', 'medium', 'high'] },
    note: { type: 'string', description: 'one short Ukrainian sentence on what could change the number, e.g. hidden oil or sauce' },
  },
};

function ask(kind: 'receipt' | 'dish', known: string[]) {
  if (kind === 'receipt')
    return (
      'This is a photo of a shop receipt, most likely Ukrainian with abbreviated product names. ' +
      'List every purchased line. Expand abbreviations into a normal product name. ' +
      'Read the pack size from the line when it is printed (280Г, 0,5Л, 1КГ) and multiply by the count; ' +
      'for loose goods sold by weight use the weight; otherwise count pieces. ' +
      `Known ingredient names to match against: ${known.join(', ')}.`
    );
  return (
    'Estimate the calories and macros of the food in this photo, as served. ' +
    'Judge the portion from the plate and cutlery size. Be honest about uncertainty in "sure" and "note". ' +
    'Write name and note in Ukrainian.'
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: { kind?: string; image?: string; known?: string[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const kind = body.kind === 'receipt' || body.kind === 'dish' ? body.kind : null;
  const image = typeof body.image === 'string' ? body.image : '';
  if (!kind || !image) return json({ error: 'need kind and image' }, 400);
  if (image.length > MAX_IMAGE) return json({ error: 'image too large' }, 413);
  const known = (Array.isArray(body.known) ? body.known : []).filter((x) => typeof x === 'string').slice(0, 300);

  const request = {
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: kind === 'receipt' ? RECEIPT : DISH } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: ask(kind, known) },
        ],
      },
    ],
  };

  try {
    let res;
    try {
      // If a safety check declines, Anthropic retries on its recommended fallback model.
      res = await client.beta.messages.create({ ...request, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any);
    } catch (e) {
      // Accounts without the fallback beta get a 400: ask again without it.
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      console.warn('retrying without fallbacks:', e.message);
      res = await client.messages.create(request as any);
    }
    if (res.stop_reason === 'refusal') return json({ error: 'declined' }, 422);
    const text = res.content.find((b: any) => b.type === 'text') as { text: string } | undefined;
    if (!text) return json({ error: 'no answer' }, 502);
    return json(JSON.parse(text.text));
  } catch (e) {
    console.error(e);
    // Status and message only (never the key), so a failed call can be diagnosed from the app side.
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    return json({ error: 'claude failed', status, detail: e instanceof Error ? e.message.slice(0, 300) : String(e) }, 502);
  }
});
