/**
 * Prompt Enhancer — Grammar & clarity improvement via Groq LLM
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function enhancePrompt(text: string): Promise<string | null> {
  if (!text.trim() || text.trim().length < 3) return null;

  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[PromptEnhancer] GROQ_API_KEY missing');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a facility management text corrector. Take the user\'s raw, often misspelled or abbreviated input and rewrite it into ONE clear, professional sentence that accurately describes the issue. Fix spelling mistakes, expand abbreviations (e.g., "1rth" → "1st floor", "ac" → "AC", "nt" → "not"), and correct grammar. Do NOT add extra details, bullet points, safety suggestions, or SLA mentions. Keep it concise and factual. Return ONLY the corrected sentence with no preamble or quotes.',
          },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    // Clean up any surrounding quotes the model might add
    return content.replace(/^["']|["']$/g, '').trim();
  } catch (err) {
    console.warn('[PromptEnhancer] Enhancement failed:', err);
    return null;
  }
}
