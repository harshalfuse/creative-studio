# Creative Studio

Internal text-to-design tool for social media creatives. Type a natural-language command, get a scroll-stopping, on-brand post in seconds. Built for Joveo's marketing, recruitment, and ops teams.

**Live:** https://creative-studio-usiq.vercel.app/

---

## What's inside

- **Magic Command bar** — type a free-form prompt ("hiring post for a senior React dev, bold navy theme") and the tool auto-fills the whole design. Uses an LLM via `/api/generate` when an API key is configured, or a keyword parser otherwise.
- **Magic Resize** — one click renders the same design across all 8 platform sizes and downloads them as a ZIP.
- **Magic Write** — contextual copy suggestions per field.
- **Brand Kit** — save multiple brands (logo + colors + handle) to the browser. Joveo's default brand kit is seeded automatically.
- **22 templates** — hiring, launch, event, quote, stat, case study, webinar, ebook, milestone, award, team spotlight, podcast, product feature, DEI, partnership, multi-role hiring, testimonial, tip, carousel cover, celebration, tech post, retro punch.
- **8 platforms, 8 styles, 6 layouts, 17 themes, 10 font pairs** — millions of combinations.
- **Background image upload** with auto overlay for readable text.
- **Copy PNG to clipboard**, download PNG at 2x resolution, share via URL.

## Run locally

Just open `index.html` — it's a single static file. The Magic Command bar will fall back to keyword mode (no API needed) when run locally without the serverless function.

## Deploy

Optimized for **Vercel**. Every push to `main` on this repo auto-deploys.

### Enabling AI mode (optional, but much more powerful)

The Magic Command bar has two modes:

- **Keyword mode** (default, zero config): parses the prompt locally for platform/style/color hints and picks a matching template.
- **AI mode** (needs one API key on Vercel): sends the prompt to an LLM which returns a full bespoke design (headline, copy, palette, layout, font) as JSON.

To enable AI mode, set exactly one of these as an environment variable in your Vercel project (Settings → Environment Variables), then redeploy:

| Env var name          | Provider                    | Free tier | Notes |
|-----------------------|-----------------------------|-----------|-------|
| `GEMINI_API_KEY`      | Google Gemini 1.5 Flash     | Yes, generous | Recommended default |
| `GROQ_API_KEY`        | Groq (Llama 3.3 70B)        | Yes, very fast | Best for speed |
| `ANTHROPIC_API_KEY`   | Claude Haiku                | Paid only | Best for quality |
| `OPENROUTER_API_KEY`  | OpenRouter (many models)    | Free tier for some models | Model-flexible |
| `OPENAI_API_KEY`      | OpenAI GPT-4o-mini          | Paid only | |

The endpoint auto-detects the first of these that is set.

**Optional model overrides** (if you want a specific model):
`GEMINI_MODEL`, `GROQ_MODEL`, `ANTHROPIC_MODEL`, `OPENROUTER_MODEL`, `OPENAI_MODEL`.

### After adding the env var

In Vercel dashboard → your project → **Deployments** → click the latest one → **Redeploy** (or push any small commit to trigger a rebuild).

## Tech

- Single-file `index.html` (~85 KB). No build step.
- Vercel Serverless Function at `/api/generate.js` for LLM access.
- Zero frontend dependencies besides CDN-loaded Google Fonts, html2canvas, JSZip, FileSaver.
- localStorage for Brand Kit and theme persistence.

## License

Internal tool. All rights reserved.
