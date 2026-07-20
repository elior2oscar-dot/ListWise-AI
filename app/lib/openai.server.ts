import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to your .env file (see .env.example).",
      );
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

const TONE_GUIDES: Record<string, string> = {
  neutral: "clear, friendly, and straightforward",
  playful: "fun, energetic, and playful, using light humor where appropriate",
  luxury: "elegant, sophisticated, and premium",
  minimal: "short, minimal, and to the point, with no fluff",
  bold: "confident, bold, and persuasive",
};

export interface ListingInput {
  title: string;
  description?: string | null;
  productType?: string | null;
  vendor?: string | null;
  tone: string;
}

export interface ListingOutput {
  title: string;
  description: string;
  metaDescription: string;
  tags: string[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateListing(input: ListingInput): Promise<ListingOutput> {
  const openai = getClient();
  const toneGuide = TONE_GUIDES[input.tone] ?? TONE_GUIDES.neutral;
  const plainDescription = input.description ? stripHtml(input.description) : "";

  const prompt = `You are an expert ecommerce copywriter and SEO specialist. Rewrite the following product listing to be SEO-optimized and written in a tone that is ${toneGuide}.

Product title: ${input.title}
${input.productType ? `Product type: ${input.productType}` : ""}
${input.vendor ? `Brand: ${input.vendor}` : ""}
Current description: ${plainDescription || "(none provided, write one from the title and product type)"}

Respond with ONLY a valid JSON object using exactly these keys:
{
  "title": "SEO-optimized product title, under 70 characters",
  "description": "Persuasive product description as 2-4 short paragraphs. You may use simple <p> HTML tags.",
  "metaDescription": "SEO meta description, under 160 characters",
  "tags": ["5 to 8 relevant search tags or keywords as short strings"]
}`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  let parsed: Partial<ListingOutput>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned a response that could not be parsed as JSON.");
  }

  return {
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : input.title,
    description: typeof parsed.description === "string" ? parsed.description : "",
    metaDescription: typeof parsed.metaDescription === "string" ? parsed.metaDescription : "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === "string") : [],
  };
}
