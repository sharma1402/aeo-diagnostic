// lib/aeo-analyzer.ts
// Core logic: queries all 3 AI engines and scores brand visibility

export interface AEOResult {
  engine: 'claude' | 'gpt4' | 'gemini';
  engineLabel: string;
  rawResponse: string;
  brandMentioned: boolean;
  brandRank: number | null; // 1-based position, null if not mentioned
  competitorsMentioned: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'not_mentioned';
  keyPhrases: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number; // 0-100
  insights: string[];
  recommendations: string[];
}

export interface AEOReport {
  query: string;
  brand: string;
  competitors: string[];
  timestamp: string;
  results: AEOResult[];
  overallGrade: string;
  overallScore: number;
  summary: string;
  topRecommendations: string[];
  competitorMatrix: CompetitorMatrix[];
}

export interface CompetitorMatrix {
  name: string;
  claude: boolean;
  gpt4: boolean;
  gemini: boolean;
  totalMentions: number;
  avgRank: number | null;
}

function calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function calculateScore(
  brandMentioned: boolean,
  brandRank: number | null,
  sentiment: string
): number {
  let score = 0;
  
  // Mentioned at all: 40 pts
  if (brandMentioned) score += 40;
  
  // Rank bonus: top rank = 40 pts, scales down
  if (brandRank !== null) {
    if (brandRank === 1) score += 40;
    else if (brandRank === 2) score += 30;
    else if (brandRank === 3) score += 20;
    else if (brandRank <= 5) score += 10;
    else score += 5;
  }
  
  // Sentiment: 20 pts
  if (sentiment === 'positive') score += 20;
  else if (sentiment === 'neutral') score += 10;
  else if (sentiment === 'negative') score -= 10;
  
  return Math.max(0, Math.min(100, score));
}

function analyzeBrandInResponse(
  response: string,
  brand: string,
  competitors: string[]
): Omit<AEOResult, 'engine' | 'engineLabel' | 'rawResponse' | 'insights' | 'recommendations' | 'grade' | 'score'> {
  const lowerResponse = response.toLowerCase();
  const lowerBrand = brand.toLowerCase();

  // Check if brand is mentioned
  const brandMentioned = lowerResponse.includes(lowerBrand);

  // Try to find brand rank in numbered list
  let brandRank: number | null = null;
  if (brandMentioned) {
    // Look for patterns like "1. BrandName", "1) BrandName", "**1. BrandName**"
    const rankPatterns = [
      new RegExp(`(\\d+)[.)\\s]+[^\\n]*${lowerBrand}`, 'i'),
      new RegExp(`${lowerBrand}[^\\n]*(#?\\d+)`, 'i'),
    ];
    for (const pattern of rankPatterns) {
      const match = response.match(pattern);
      if (match) {
        const num = parseInt(match[1] || match[2]);
        if (num >= 1 && num <= 10) {
          brandRank = num;
          break;
        }
      }
    }
    // If mentioned but no rank found, assign rank based on position in text
    if (!brandRank) {
      const pos = lowerResponse.indexOf(lowerBrand);
      const totalLength = lowerResponse.length;
      brandRank = pos < totalLength * 0.25 ? 1 : pos < totalLength * 0.5 ? 2 : 3;
    }
  }

  // Find competitors mentioned
  const competitorsMentioned = competitors.filter(c =>
    lowerResponse.includes(c.toLowerCase())
  );

  // Detect sentiment around brand mention
  let sentiment: 'positive' | 'neutral' | 'negative' | 'not_mentioned' = 'not_mentioned';
  if (brandMentioned) {
    const brandIdx = lowerResponse.indexOf(lowerBrand);
    const context = lowerResponse.slice(Math.max(0, brandIdx - 150), brandIdx + 150);
    
    const positiveWords = ['best', 'top', 'highly rated', 'recommended', 'excellent', 'great', 'superior', 'leading', 'popular', 'trusted', 'effective'];
    const negativeWords = ['avoid', 'poor', 'bad', 'worst', 'inferior', 'unreliable', 'overpriced', 'disappointing'];
    
    const posCount = positiveWords.filter(w => context.includes(w)).length;
    const negCount = negativeWords.filter(w => context.includes(w)).length;
    
    if (posCount > negCount) sentiment = 'positive';
    else if (negCount > posCount) sentiment = 'negative';
    else sentiment = 'neutral';
  }

  // Extract key phrases (simple: grab first sentences mentioning brand or health terms)
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const keyPhrases = sentences
    .filter(s => s.toLowerCase().includes(lowerBrand) || 
                 ['recommend', 'best', 'top', 'consider', 'suggest'].some(w => s.toLowerCase().includes(w)))
    .slice(0, 3)
    .map(s => s.trim());

  return {
    brandMentioned,
    brandRank,
    competitorsMentioned,
    sentiment,
    keyPhrases,
  };
}

async function queryClaudeEngine(query: string, brand: string, competitors: string[]): Promise<AEOResult> {
  const systemPrompt = `You are a helpful product recommendation assistant. When asked about products, give honest, specific recommendations with rankings. Format your response as a numbered list of top recommendations with brief explanations.`;
  
  const userPrompt = `${query}

Please provide your top 5-7 recommendations. Be specific about brand names and why each is good.`;

  let rawResponse = '';
  
  try {
    const response = await fetch('/api/query-claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt }),
    });
    const data = await response.json();
    rawResponse = data.response || 'No response received';
  } catch (e) {
    rawResponse = `Error querying Claude: ${e}`;
  }

  const analysis = analyzeBrandInResponse(rawResponse, brand, competitors);
  const score = calculateScore(analysis.brandMentioned, analysis.brandRank, analysis.sentiment);
  
  return {
    engine: 'claude',
    engineLabel: 'Claude (Anthropic)',
    rawResponse,
    ...analysis,
    grade: calculateGrade(score),
    score,
    insights: generateInsights('Claude', analysis, brand),
    recommendations: generateRecommendations('Claude', analysis, brand),
  };
}

async function queryGPT4Engine(query: string, brand: string, competitors: string[]): Promise<AEOResult> {
  let rawResponse = '';
  
  try {
    const response = await fetch('/api/query-gpt4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();
    rawResponse = data.response || 'No response received';
  } catch (e) {
    rawResponse = `Error querying GPT-4: ${e}`;
  }

  const analysis = analyzeBrandInResponse(rawResponse, brand, competitors);
  const score = calculateScore(analysis.brandMentioned, analysis.brandRank, analysis.sentiment);
  
  return {
    engine: 'gpt4',
    engineLabel: 'GPT-4o (OpenAI)',
    rawResponse,
    ...analysis,
    grade: calculateGrade(score),
    score,
    insights: generateInsights('GPT-4o', analysis, brand),
    recommendations: generateRecommendations('GPT-4o', analysis, brand),
  };
}

async function queryGeminiEngine(query: string, brand: string, competitors: string[]): Promise<AEOResult> {
  let rawResponse = '';
  
  try {
    const response = await fetch('/api/query-gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();
    rawResponse = data.response || 'No response received';
  } catch (e) {
    rawResponse = `Error querying Gemini: ${e}`;
  }

  const analysis = analyzeBrandInResponse(rawResponse, brand, competitors);
  const score = calculateScore(analysis.brandMentioned, analysis.brandRank, analysis.sentiment);
  
  return {
    engine: 'gemini',
    engineLabel: 'Gemini Pro (Google)',
    rawResponse,
    ...analysis,
    grade: calculateGrade(score),
    score,
    insights: generateInsights('Gemini', analysis, brand),
    recommendations: generateRecommendations('Gemini', analysis, brand),
  };
}

function generateInsights(engine: string, analysis: ReturnType<typeof analyzeBrandInResponse>, brand: string): string[] {
  const insights: string[] = [];
  
  if (!analysis.brandMentioned) {
    insights.push(`${brand} is invisible to ${engine} — not appearing in any recommendations`);
    if (analysis.competitorsMentioned.length > 0) {
      insights.push(`Your competitors (${analysis.competitorsMentioned.slice(0, 2).join(', ')}) ARE showing up, giving them a significant edge`);
    }
  } else {
    if (analysis.brandRank === 1) {
      insights.push(`${brand} ranks #1 on ${engine} — excellent AI visibility`);
    } else if (analysis.brandRank && analysis.brandRank <= 3) {
      insights.push(`${brand} appears in top 3 on ${engine} — strong positioning`);
    } else {
      insights.push(`${brand} is mentioned but ranked lower — room to improve prominence`);
    }
    
    if (analysis.sentiment === 'positive') {
      insights.push(`${engine} associates ${brand} with positive attributes — good brand signals`);
    } else if (analysis.sentiment === 'negative') {
      insights.push(`${engine} shows negative sentiment around ${brand} — review signals in training data`);
    }
  }
  
  if (analysis.competitorsMentioned.length >= 3) {
    insights.push(`Heavy competitor presence (${analysis.competitorsMentioned.length} rivals mentioned) — crowded space`);
  }
  
  return insights;
}

function generateRecommendations(engine: string, analysis: ReturnType<typeof analyzeBrandInResponse>, brand: string): string[] {
  const recs: string[] = [];
  
  if (!analysis.brandMentioned) {
    recs.push(`Create authoritative content targeting exact queries like this — AI engines reward comprehensive, trustworthy sources`);
    recs.push(`Get mentioned on high-authority sites (Reddit, Amazon reviews, health blogs) that AI engines index heavily`);
    recs.push(`Add structured FAQ pages answering "best [product category]" questions directly`);
  } else if (analysis.brandRank && analysis.brandRank > 3) {
    recs.push(`Strengthen your E-E-A-T signals (Expertise, Experience, Authoritativeness, Trust) — publish expert-authored content`);
    recs.push(`Accumulate more 3rd-party reviews and endorsements that AI engines can reference`);
  }
  
  if (analysis.sentiment === 'negative') {
    recs.push(`Address negative signals: respond to reviews, update product pages, and build positive PR coverage`);
  }
  
  if (analysis.sentiment !== 'positive' && analysis.brandMentioned) {
    recs.push(`Add clinically-backed claims and certifications to your product pages to improve sentiment signals`);
  }
  
  return recs;
}

function buildCompetitorMatrix(brand: string, competitors: string[], results: AEOResult[]): CompetitorMatrix[] {
  const allNames = [brand, ...competitors];
  
  return allNames.map(name => {
    const claudeResult = results.find(r => r.engine === 'claude');
    const gpt4Result = results.find(r => r.engine === 'gpt4');
    const geminiResult = results.find(r => r.engine === 'gemini');
    
    const isBrand = name === brand;
    
    const inClaude = isBrand ? (claudeResult?.brandMentioned ?? false) : (claudeResult?.competitorsMentioned.map(c=>c.toLowerCase()).includes(name.toLowerCase()) ?? false);
    const inGpt4 = isBrand ? (gpt4Result?.brandMentioned ?? false) : (gpt4Result?.competitorsMentioned.map(c=>c.toLowerCase()).includes(name.toLowerCase()) ?? false);
    const inGemini = isBrand ? (geminiResult?.brandMentioned ?? false) : (geminiResult?.competitorsMentioned.map(c=>c.toLowerCase()).includes(name.toLowerCase()) ?? false);
    
    const totalMentions = [inClaude, inGpt4, inGemini].filter(Boolean).length;
    
    let avgRank: number | null = null;
    if (isBrand) {
      const ranks = [claudeResult?.brandRank, gpt4Result?.brandRank, geminiResult?.brandRank].filter((r): r is number => r !== null && r !== undefined);
      if (ranks.length > 0) avgRank = Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length);
    }
    
    return { name, claude: inClaude, gpt4: inGpt4, gemini: inGemini, totalMentions, avgRank };
  });
}

export async function runAEODiagnostic(
  query: string,
  brand: string,
  competitors: string[]
): Promise<AEOReport> {
  // Query all three engines in parallel
  const [claudeResult, gpt4Result, geminiResult] = await Promise.all([
    queryClaudeEngine(query, brand, competitors),
    queryGPT4Engine(query, brand, competitors),
    queryGeminiEngine(query, brand, competitors),
  ]);

  const results = [claudeResult, gpt4Result, geminiResult];
  
  // Calculate overall score
  const overallScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
  const overallGrade = calculateGrade(overallScore);
  
  // Build competitor matrix
  const competitorMatrix = buildCompetitorMatrix(brand, competitors, results);
  
  // Build summary
  const mentionedCount = results.filter(r => r.brandMentioned).length;
  const summary = mentionedCount === 3
    ? `${brand} appears across all 3 AI engines — solid AEO foundation with room to improve rankings.`
    : mentionedCount === 2
    ? `${brand} appears in 2 of 3 AI engines — one engine is a blind spot to address immediately.`
    : mentionedCount === 1
    ? `${brand} only appears in 1 AI engine — critical AEO gap that's costing you customer discovery.`
    : `${brand} is invisible across all AI engines — urgent action needed on content and authority signals.`;

  // Collect top recommendations
  const allRecs = results.flatMap(r => r.recommendations);
  const uniqueRecs = Array.from(new Set(allRecs)).slice(0, 5);

  return {
    query,
    brand,
    competitors,
    timestamp: new Date().toISOString(),
    results,
    overallGrade,
    overallScore,
    summary,
    topRecommendations: uniqueRecs,
    competitorMatrix,
  };
}
