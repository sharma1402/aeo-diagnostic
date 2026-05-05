// pages/api/query-gemini.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({model: "gemini-2.0-flash"});
    
    const prompt = `You are a helpful product recommendation assistant. When asked about products, give honest, specific recommendations with rankings. Format your response as a numbered list of top recommendations with brief explanations.

${query}

Please provide your top 5-7 recommendations. Be specific about brand names and why each is good.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    res.status(200).json({ response });
  } catch (error: unknown) {
    console.error("Gemini API error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes("429") ||
      lowerMessage.includes("quota") ||
      lowerMessage.includes("too many requests")
    ) {
      return res.status(200).json({
        response:
          "Gemini unavailable: quota exceeded. Skipping Gemini analysis for now.",
      });
    }

    return res.status(500).json({
      error: "Gemini API error",
      details: message,
    });
  }
}
