import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userPrompt } = req.body;

  try {
    const response = await fetch('https://api.cohere.com/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'command-r-plus',
        message: `You are a helpful product recommendation assistant. Give honest specific recommendations as a numbered list.\n\n${userPrompt}\n\nProvide top 5-7 recommendations with brand names.`,
        max_tokens: 1024,
      }),
    });

    const data = await response.json();
    const text = data.text || '';
    res.status(200).json({ response: text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Cohere API error', details: message });
  }
}