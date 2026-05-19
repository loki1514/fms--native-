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
              'You are a professional writing assistant. Improve the grammar, clarity, spelling, and professionalism of the user\'s text. Keep the original meaning, tone (casual vs formal), and language. Fix punctuation and capitalization. Return ONLY the improved text with no explanations, no quotes around the output, and no preamble.',
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
