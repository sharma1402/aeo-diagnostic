# AEO Diagnostic 🎯
### AI Visibility Report Card — Does Your Brand Show Up When Customers Ask AI What to Buy?

**Live Demo:** [aeo-diagnostic.vercel.app](https://aeo-diagnostic.vercel.app) *(deploy your own below)*

---

## What It Does

Paste in any shopper query like _"best magnesium supplement for seniors"_ and this tool:

1. **Simultaneously queries** Claude (Anthropic), GPT-4o (OpenAI), and Gemini Pro (Google)
2. **Detects** whether your brand appears in each response
3. **Ranks** where your brand sits (1st, 2nd, 3rd…)
4. **Grades** you A–F per engine with an overall score (0–100)
5. **Maps competitors** — who's beating you and on which engines
6. **Generates recommendations** tailored to each engine's blind spots

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (TypeScript) |
| APIs | Anthropic Claude, OpenAI GPT-4o, Google Gemini Pro |
| Styling | CSS Variables + Inline Styles (zero external CSS deps) |
| Deployment | Vercel (one-click) |

---

## Setup (5 minutes)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/aeo-diagnostic.git
cd aeo-diagnostic
npm install
```

### 2. Add API Keys

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
ANTHROPIC_API_KEY=sk-ant-...        # https://console.anthropic.com
OPENAI_API_KEY=sk-...               # https://platform.openai.com
GEMINI_API_KEY=AIza...              # https://aistudio.google.com
```

### 3. Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

### 4. Deploy to Vercel

```bash
npx vercel --prod
```

Add your 3 API keys in Vercel's Environment Variables dashboard.

---

## Usage

1. **Enter a query** — type what a customer would ask an AI assistant
   - e.g. `"best magnesium for sleep"`, `"most effective protein powder for women"`
2. **Enter your brand name** — exactly as it appears in Amazon/Google listings
3. **Enter competitors** — comma-separated list
4. **Click Run** — results appear in ~5-8 seconds

---

## How Scoring Works

| Criteria | Points |
|----------|--------|
| Brand mentioned at all | +40 |
| Ranked #1 | +40 |
| Ranked #2 | +30 |
| Ranked #3 | +20 |
| Ranked #4-5 | +10 |
| Positive sentiment | +20 |
| Neutral sentiment | +10 |
| Negative sentiment | -10 |

**Grade Scale:** A (85+), B (70+), C (55+), D (40+), F (<40)

---

## Project Structure

```
aeo-diagnostic/
├── pages/
│   ├── index.tsx           ← Main UI
│   └── api/
│       ├── analyze.ts      ← Orchestrator (calls all 3 engines)
│       ├── query-claude.ts ← Claude API
│       ├── query-gpt4.ts   ← OpenAI GPT-4o API
│       └── query-gemini.ts ← Google Gemini API
├── lib/
│   └── aeo-analyzer.ts     ← Core scoring & analysis logic
├── styles/
│   └── globals.css         ← Design tokens & typography
└── .env.example
```

---

## What Makes This Different

Most SEO tools check Google rankings. This checks **AI rankings** — the next frontier.

As 30%+ of product queries now start with an AI assistant instead of a search engine, brands that rank well in AI responses get free, trusted recommendations to millions of customers. This tool measures exactly that.

**Unique features:**
- Side-by-side comparison across all 3 major AI engines
- Competitor visibility matrix (who's winning where)
- Per-engine tailored recommendations (what Claude weights differently vs GPT-4o)
- Raw response viewer to see exact AI wording
- Export to JSON for tracking over time

---

## If I Had More Time

- [ ] **Trend tracking** — run weekly and chart your score over time
- [ ] **Batch mode** — test 20 queries at once for full keyword coverage
- [ ] **Amazon Rufus integration** — check AI visibility inside Amazon itself
- [ ] **Email alerts** — notify when a competitor's score surpasses yours
- [ ] **LLM fine-print analysis** — detect what specific phrases/claims trigger positive mentions

---

## Built For

This project was built as part of a hiring challenge demonstrating:
- Multi-API integration (Claude + OpenAI + Gemini)
- User-first product thinking ("what does the brand manager actually need?")
- Deployable in under 5 hours
- Immediately useful for the hiring company's Amazon brand business

---

*Made with ♥ and a lot of API calls*
