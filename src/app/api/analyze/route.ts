import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters forwarded to OpenAI (~3 000 tokens). */
const MAX_TEXT_CHARS = 12_000;

/** Minimum characters to be considered a real resume. */
const MIN_TEXT_CHARS = 100;

/** Hard cap on OpenAI completion tokens. */
const MAX_COMPLETION_TOKENS = 2_000;

const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

// ─── OpenAI client ────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

async function extractText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (file.type === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default as (
      buffer: Buffer
    ) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Guard: API key must be configured
  if (
    !process.env.OPENAI_KEY ||
    process.env.OPENAI_KEY === "your_openai_api_key_here"
  ) {
    return NextResponse.json(
      {
        error:
          "OpenAI API key is not configured. Add OPENAI_KEY to your .env file.",
      },
      { status: 503 }
    );
  }

  // 2. Rate limiting
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip);

  const rateLimitHeaders = {
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  };

  if (!rateLimit.allowed) {
    const retryAfterSec = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: `Too many requests. You can analyze up to 5 resumes per hour. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`,
      },
      {
        status: 429,
        headers: { ...rateLimitHeaders, "Retry-After": String(retryAfterSec) },
      }
    );
  }

  try {
    // 3. Parse form data
    const formData = await request.formData();
    const file = formData.get("resume") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // 4. File type validation (server-side)
    if (!SUPPORTED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file format. Please upload a PDF, DOCX, or TXT file.",
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // 5. File size guard (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 10 MB." },
        { status: 413, headers: rateLimitHeaders }
      );
    }

    // 6. Extract text
    let text: string;
    try {
      text = await extractText(file);
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not extract text. The file may be corrupted or password-protected.",
        },
        { status: 422, headers: rateLimitHeaders }
      );
    }

    const trimmed = text.trim();

    // 7. Content length guards
    if (trimmed.length < MIN_TEXT_CHARS) {
      return NextResponse.json(
        {
          error:
            "The file contains too little text to be a resume. Please check your file and try again.",
        },
        { status: 422, headers: rateLimitHeaders }
      );
    }

    // Truncate to cap token consumption
    const safeText =
      trimmed.length > MAX_TEXT_CHARS
        ? trimmed.slice(0, MAX_TEXT_CHARS) + "\n\n[Content truncated]"
        : trimmed;

    // 8. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert resume consultant and career coach with 20+ years of experience helping candidates land jobs at top companies — FAANG, Fortune 500s, and high-growth startups.

Carefully read the ENTIRE resume text the user provides and return a thorough JSON analysis.

Return ONLY valid JSON with this EXACT structure (no extra keys, no markdown):
{
  "score": <integer 0-100, honest assessment>,
  "summary": "<2-3 sentences: overall quality, biggest strengths, most urgent gap>",
  "strengths": [
    "<specific strength observed in the resume — quote or reference actual content>"
  ],
  "weaknesses": [
    "<specific weakness — be direct, reference actual content where possible>"
  ],
  "improvements": [
    {
      "title": "<short imperative title, e.g. 'Quantify your impact'>",
      "description": "<concrete, step-by-step instruction the candidate can act on today>",
      "priority": "high" | "medium" | "low"
    }
  ],
  "suggestedRewrites": [
    {
      "section": "<which resume section this line lives in, e.g. 'Work Experience', 'Summary', 'Skills'>",
      "original": "<copy the exact or near-exact text from the resume that should change>",
      "improved": "<your drop-in replacement — stronger verbs, metrics, specificity>",
      "reason": "<one sentence explaining why this version is stronger>"
    }
  ],
  "missingSections": [
    "<name of a section that is absent or critically underdeveloped, e.g. 'Professional Summary', 'Quantified Achievements', 'GitHub / Portfolio URL', 'Certifications'>"
  ],
  "atsKeywords": ["<industry keyword not present in resume but expected by ATS>"],
  "formattingTips": ["<specific, visual formatting improvement>"]
}

Rules for suggestedRewrites:
- Provide exactly 3-5 rewrites.
- Each "original" MUST be text that actually appears in (or is a close paraphrase of) the resume.
- Focus on: weak action verbs, missing numbers/metrics, vague responsibilities, passive voice.
- Each "improved" version should be a ready-to-paste replacement.

Rules for missingSections:
- Only list sections that are genuinely absent or severely lacking.
- Do NOT list sections that exist but are weak — those belong in improvements.

Scoring guide:
- 90-100: Outstanding, near-perfect
- 75-89: Strong with minor issues
- 60-74: Average, meaningful improvements needed
- 40-59: Weak, significant gaps
- 0-39: Major overhaul required`,
        },
        {
          role: "user",
          content: `Please analyze this resume:\n\n${safeText}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: MAX_COMPLETION_TOKENS,
    });

    const raw = completion.choices[0].message.content;
    if (!raw) throw new Error("Empty response from AI");

    const analysis = JSON.parse(raw);
    return NextResponse.json(analysis, { headers: rateLimitHeaders });
  } catch (error) {
    console.error("Resume analysis error:", error);

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          {
            error:
              "Invalid OpenAI API key. Please check your .env configuration.",
          },
          { status: 500, headers: rateLimitHeaders }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: "OpenAI rate limit reached. Please try again shortly." },
          { status: 429, headers: rateLimitHeaders }
        );
      }
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: 502, headers: rateLimitHeaders }
      );
    }

    return NextResponse.json(
      { error: "Failed to analyze resume. Please try again." },
      { status: 500, headers: rateLimitHeaders }
    );
  }
}
