// pages/api/analyze.ts
import type { NextApiRequest, NextApiResponse } from "next";

type EngineResult = {
  engine: string;
  engineLabel: string;
  rawResponse: string;
  brandMentioned: boolean;
  brandRank: number | null;
  competitorsMentioned: string[];
  sentiment: string;
  keyPhrases: string[];
  grade: string;
  score: number;
  insights: string[];
  recommendations: string[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, brand, competitors } = req.body;

  if (!query || !brand) {
    return res.status(400).json({ error: "query and brand are required" });
  }

  const competitorList: string[] = String(competitors || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const systemPrompt =
      "You are a helpful product recommendation assistant. When asked about products, give honest, specific recommendations with rankings. Format your response as a numbered list of top recommendations with brief explanations.";

    const userPrompt = `${query}

Please provide your top 5-7 recommendations. Be specific about brand names and why each is good.`;

    const [cohereRes, groqRes, geminiRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/query-claude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userPrompt }),
      }).then((r) => r.json()),

      fetch(`${baseUrl}/api/query-gpt4`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      }).then((r) => r.json()),

      fetch(`${baseUrl}/api/query-gemini`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      }).then((r) => r.json()),
    ]);

    const getSafeResponse = (
      result: PromiseSettledResult<any>,
      label: string
    ): string => {
      if (
        result.status === "fulfilled" &&
        typeof result.value?.response === "string"
      ) {
        return result.value.response;
      }

      if (
        result.status === "fulfilled" &&
        typeof result.value?.error === "string"
      ) {
        return `Error from ${label}: ${result.value.error}`;
      }

      if (result.status === "rejected") {
        return `Error from ${label}: ${String(result.reason)}`;
      }

      return `Error from ${label}: No valid response received`;
    };

    const cohereResponse = getSafeResponse(cohereRes, "Cohere");
    const groqResponse = getSafeResponse(groqRes, "Groq");
    const geminiResponse = getSafeResponse(geminiRes, "Gemini");

    const analyzeResponse = (
      response: string,
      engineLabel: string,
      engine: string
    ): EngineResult => {
      const safeResponse = typeof response === "string" ? response : "";
      const lowerResponse = safeResponse.toLowerCase();
      const lowerBrand = String(brand).toLowerCase();

      const brandMentioned = lowerResponse.includes(lowerBrand);

      let brandRank: number | null = null;

      if (brandMentioned) {
        const escapedBrand = lowerBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rankPattern = new RegExp(
          `(\\d+)[.)\\s]+[^\\n]*${escapedBrand}`,
          "i"
        );

        const match = safeResponse.match(rankPattern);

        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= 1 && num <= 10) brandRank = num;
        }

        if (!brandRank) {
          const pos = lowerResponse.indexOf(lowerBrand);
          const totalLength = lowerResponse.length;

          brandRank =
            pos < totalLength * 0.25 ? 1 : pos < totalLength * 0.5 ? 2 : 3;
        }
      }

      const competitorsMentioned = competitorList.filter((c) =>
        lowerResponse.includes(c.toLowerCase())
      );

      let sentiment = "not_mentioned";

      if (brandMentioned) {
        const brandIdx = lowerResponse.indexOf(lowerBrand);
        const context = lowerResponse.slice(
          Math.max(0, brandIdx - 150),
          brandIdx + 150
        );

        const positiveWords = [
          "best",
          "top",
          "highly rated",
          "recommended",
          "excellent",
          "great",
          "superior",
          "leading",
          "popular",
          "trusted",
          "effective",
        ];

        const negativeWords = [
          "avoid",
          "poor",
          "bad",
          "worst",
          "inferior",
          "unreliable",
          "overpriced",
          "disappointing",
        ];

        const posCount = positiveWords.filter((w) =>
          context.includes(w)
        ).length;

        const negCount = negativeWords.filter((w) =>
          context.includes(w)
        ).length;

        sentiment =
          posCount > negCount
            ? "positive"
            : negCount > posCount
            ? "negative"
            : "neutral";
      }

      let score = 0;

      if (brandMentioned) score += 40;

      if (brandRank !== null) {
        if (brandRank === 1) score += 40;
        else if (brandRank === 2) score += 30;
        else if (brandRank === 3) score += 20;
        else if (brandRank <= 5) score += 10;
        else score += 5;
      }

      if (sentiment === "positive") score += 20;
      else if (sentiment === "neutral") score += 10;
      else if (sentiment === "negative") score -= 10;

      score = Math.max(0, Math.min(100, score));

      const grade =
        score >= 85
          ? "A"
          : score >= 70
          ? "B"
          : score >= 55
          ? "C"
          : score >= 40
          ? "D"
          : "F";

      const insights: string[] = [];
      const recommendations: string[] = [];

      if (!brandMentioned) {
        insights.push(
          `${brand} is invisible to ${engineLabel} — not appearing in any recommendations`
        );

        if (competitorsMentioned.length > 0) {
          insights.push(
            `Competitors (${competitorsMentioned
              .slice(0, 2)
              .join(", ")}) ARE showing up`
          );
        }

        recommendations.push(
          "Create authoritative content targeting exact queries like this"
        );
        recommendations.push(
          "Get mentioned on high-authority review sites and forums AI engines index"
        );
      } else {
        if (brandRank === 1) {
          insights.push(
            `${brand} ranks #1 on ${engineLabel} — excellent AI visibility`
          );
        } else if (brandRank && brandRank <= 3) {
          insights.push(`${brand} appears in top 3 on ${engineLabel}`);
        } else {
          insights.push(`${brand} mentioned but ranked lower — room to improve`);
        }

        if (sentiment === "positive") {
          insights.push(
            `${engineLabel} associates ${brand} with positive attributes`
          );
        } else if (sentiment === "negative") {
          insights.push("Negative sentiment detected — review your brand signals");
        }

        recommendations.push(
          "Strengthen E-E-A-T signals with expert-authored content"
        );
      }

      const sentences = safeResponse
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 20);

      const keyPhrases = sentences
        .filter(
          (s) =>
            s.toLowerCase().includes(lowerBrand) ||
            ["recommend", "best", "top", "consider"].some((w) =>
              s.toLowerCase().includes(w)
            )
        )
        .slice(0, 3)
        .map((s) => s.trim());

      return {
        engine,
        engineLabel,
        rawResponse: safeResponse,
        brandMentioned,
        brandRank,
        competitorsMentioned,
        sentiment,
        keyPhrases,
        grade,
        score,
        insights,
        recommendations,
      };
    };

    const results = [
      analyzeResponse(cohereResponse, "Cohere Command R+", "cohere"),
      analyzeResponse(groqResponse, "Groq LLaMA 3.3", "groq"),
      analyzeResponse(geminiResponse, "Gemini Flash", "gemini"),
    ];

    const overallScore = Math.round(
      results.reduce((sum, r) => sum + r.score, 0) / results.length
    );

    const overallGrade =
      overallScore >= 85
        ? "A"
        : overallScore >= 70
        ? "B"
        : overallScore >= 55
        ? "C"
        : overallScore >= 40
        ? "D"
        : "F";

    const mentionedCount = results.filter((r) => r.brandMentioned).length;

    const summary =
      mentionedCount === 3
        ? `${brand} appears across all 3 AI engines — solid AEO foundation.`
        : mentionedCount === 2
        ? `${brand} appears in 2 of 3 AI engines — one engine is a blind spot.`
        : mentionedCount === 1
        ? `${brand} only appears in 1 AI engine — critical AEO gap.`
        : `${brand} is invisible across all AI engines — urgent action needed.`;

    const allNames = [brand, ...competitorList];

    const competitorMatrix = allNames.map((name) => {
      const isBrand = name === brand;

      const inCohere = isBrand
        ? results[0].brandMentioned
        : results[0].competitorsMentioned
            .map((c) => c.toLowerCase())
            .includes(name.toLowerCase());

      const inGroq = isBrand
        ? results[1].brandMentioned
        : results[1].competitorsMentioned
            .map((c) => c.toLowerCase())
            .includes(name.toLowerCase());

      const inGemini = isBrand
        ? results[2].brandMentioned
        : results[2].competitorsMentioned
            .map((c) => c.toLowerCase())
            .includes(name.toLowerCase());

      const totalMentions = [inCohere, inGroq, inGemini].filter(Boolean).length;

      let avgRank: number | null = null;

      if (isBrand) {
        const ranks = [
          results[0].brandRank,
          results[1].brandRank,
          results[2].brandRank,
        ].filter((r): r is number => r !== null && r !== undefined);

        if (ranks.length > 0) {
          avgRank = Math.round(
            ranks.reduce((a, b) => a + b, 0) / ranks.length
          );
        }
      }

      return {
        name,
        cohere: inCohere,
        groq: inGroq,
        gemini: inGemini,
        totalMentions,
        avgRank,
      };
    });

    const allRecs = results.flatMap((r) => r.recommendations);
    const topRecommendations = Array.from(new Set(allRecs)).slice(0, 5);

    return res.status(200).json({
      query,
      brand,
      competitors: competitorList,
      timestamp: new Date().toISOString(),
      results,
      overallGrade,
      overallScore,
      summary,
      topRecommendations,
      competitorMatrix,
    });
  } catch (error: unknown) {
    console.error("Analysis error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    return res.status(500).json({
      error: "Analysis failed",
      details: message,
    });
  }
}