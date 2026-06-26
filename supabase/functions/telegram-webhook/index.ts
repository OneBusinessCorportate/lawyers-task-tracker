import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_CHAT_ID = -5483561137;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Category detection keywords
const CATEGORY_KEYWORDS: Record<string, string> = {
  "կommunikaciya": "communication",
  "կommunication": "communication",
  "kommunikaciya": "communication",
  "коммуникация": "communication",
  "kommunikacja": "communication",
  "arajadrank": "task",
  "аражадранк": "task",
  "առажадранк": "task",
  "zhatatner": "chats",
  "zhater": "chats",
  "չатер": "chats",
  "чатер": "chats",
  "чаты": "chats",
};

function detectCategory(line: string): string | null {
  const lower = line.toLowerCase().trim();
  for (const [kw, cat] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(kw)) return cat;
  }
  // Armenian script category headers (single-line, no dash, no client)
  const armCategoryPatterns = [
    /^կоммуникация$/i,
    /^коммуникация$/i,
    /^аражадранк$/i,
    /^чатер$/i,
    /^чаты$/i,
    /^կոммуникация$/i,
  ];
  for (const p of armCategoryPatterns) {
    if (p.test(lower)) return lower.includes("ком") ? "communication" : lower.includes("жад") || lower.includes("jaда") ? "task" : "chats";
  }
  return null;
}

function parseTime(token: string): number | null {
  // "45 rpoe" / "45 rpoe" / "45 min" / "45 мин" / "45 minutes"
  // "3.5 jam" / "3.5 zham" / "3.5 hours" / "3.5 ч"
  // "2 jam" / "2 hour" / "2 ч"
  const t = token.toLowerCase().trim();
  const numMatch = t.match(/^(\d+(?:[.,]\d+)?)/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[1].replace(",", "."));
  if (
    t.includes("ропe") || t.includes("rpoe") || t.includes("рope") || t.includes("rope") ||
    t.includes("min") || t.includes("мин") || t.includes("rpoe") || t.includes("ропе") ||
    t.includes("rpm") || t.includes("rop")
  ) return Math.round(num);
  if (
    t.includes("jam") || t.includes("zham") || t.includes("hour") || t.includes("ч") ||
    t.includes("жam") || t.includes("ям") || t.includes("жа")
  ) return Math.round(num * 60);
  return null;
}

function extractTimeFromTokens(parts: string[]): { time: number | null; remainingParts: string[] } {
  // Scan all parts for time patterns
  const timePatterns = [
    /^(\d+(?:[.,]\d+)?)\s*(ропе?|rpoe?|рope?|rope?|мин|min|минут|minutes?)/i,
    /^(\d+(?:[.,]\d+)?)\s*(жам|jam|zham|жа|ч(?:ас)?|час(?:ов|а)?|hour[s]?)/i,
  ];
  const remaining: string[] = [];
  let time: number | null = null;
  for (const part of parts) {
    let matched = false;
    for (const pat of timePatterns) {
      const m = part.trim().match(pat);
      if (m) {
        const num = parseFloat(m[1].replace(",", "."));
        const unit = m[2].toLowerCase();
        if (unit.startsWith("ж") || unit.startsWith("j") || unit.startsWith("ч") || unit.startsWith("h")) {
          time = Math.round(num * 60);
        } else {
          time = Math.round(num);
        }
        matched = true;
        break;
      }
    }
    if (!matched) remaining.push(part);
  }
  return { time, remainingParts: remaining };
}

interface ParsedTask {
  client_name: string | null;
  task_description: string;
  time_minutes: number | null;
  is_completed: boolean;
  category: string;
  raw_line: string;
}

function parseLine(line: string, currentCategory: string): ParsedTask | null {
  const raw = line;
  const isCompleted = line.includes("✅");
  line = line.replace("✅", "").trim();

  // Split on –, —, or - (dash separators)
  const parts = line.split(/\s*[–—]\s*|\s+-\s+/).map(p => p.trim()).filter(Boolean);

  if (parts.length === 0) return null;

  // Try to find time in any part
  let timeMinutes: number | null = null;
  const cleanedParts: string[] = [];
  for (const part of parts) {
    const t = parseTime(part);
    if (t !== null && timeMinutes === null) {
      timeMinutes = t;
    } else {
      // Also check inline: "45 rpoe" embedded in larger text
      const inlineMatch = part.match(/(\d+(?:[.,]\d+)?)\s*(ропе?|мин|min|жам|jam|zham|час|hour[s]?)/i);
      if (inlineMatch && timeMinutes === null) {
        const num = parseFloat(inlineMatch[1].replace(",", "."));
        const unit = inlineMatch[2].toLowerCase();
        if (unit.startsWith("ж") || unit.startsWith("j") || unit.startsWith("ч") || unit.startsWith("h")) {
          timeMinutes = Math.round(num * 60);
        } else {
          timeMinutes = Math.round(num);
        }
        // Remove the time portion from part
        cleanedParts.push(part.replace(inlineMatch[0], "").trim());
      } else {
        cleanedParts.push(part);
      }
    }
  }

  if (cleanedParts.length === 0) return null;

  let clientName: string | null = null;
  let taskDesc = "";

  if (cleanedParts.length === 1) {
    taskDesc = cleanedParts[0];
  } else {
    clientName = cleanedParts[0];
    taskDesc = cleanedParts.slice(1).join(" – ");
  }

  return {
    client_name: clientName || null,
    task_description: taskDesc,
    time_minutes: timeMinutes,
    is_completed: isCompleted,
    category: currentCategory,
    raw_line: raw,
  };
}

function extractDateFromText(text: string): string | null {
  // Match "25.06" or "25.06.2026" patterns
  const m = text.match(/(\d{1,2})\.(\d{2})(?:\.(\d{4}))?/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  const year = m[3] || new Date().getFullYear().toString();
  return `${year}-${month}-${day}`;
}

function isCategoryHeader(line: string): string | null {
  const clean = line.replace("✅", "").trim().toLowerCase();
  if (clean.includes("коммуникация") || clean.includes("kommunikaciya") || clean.includes("կommunication")) return "communication";
  if (clean.includes("аражадранк") || clean.includes("arajadrank") || clean.includes("задач")) return "task";
  if (clean.includes("чатер") || clean.includes("чаты") || clean.includes("zhater")) return "chats";
  // Single word lines that look like headers (no – separator, no client name pattern)
  if (!line.includes("–") && !line.includes("—") && !line.match(/\s+-\s+/) && clean.split(/\s+/).length <= 3) {
    // Could be a header, but be conservative
    return null;
  }
  return null;
}

function parseReport(text: string): { date: string | null; tasks: ParsedTask[] } {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let date: string | null = null;
  let currentCategory = "uncategorized";
  const tasks: ParsedTask[] = [];

  for (const line of lines) {
    // Try date header
    if (/^\d{1,2}\.\d{2}/.test(line)) {
      const d = extractDateFromText(line);
      if (d) date = d;
      continue;
    }

    // Try category header
    const catHeader = isCategoryHeader(line);
    if (catHeader) {
      currentCategory = catHeader;
      continue;
    }

    // Try to parse as task line
    const task = parseLine(line, currentCategory);
    if (task) tasks.push(task);
  }

  return { date, tasks };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const message = (body.message || body.channel_post) as Record<string, unknown> | undefined;
  if (!message) return new Response("OK", { status: 200 });

  const chatId = (message.chat as Record<string, unknown>)?.id as number;
  if (chatId !== ALLOWED_CHAT_ID) return new Response("OK", { status: 200 });

  const messageId = message.message_id as number;
  const text = (message.text || message.caption) as string | undefined;
  if (!text) return new Response("OK", { status: 200 });

  const from = message.from as Record<string, unknown> | undefined;
  const senderId = from?.id as number | undefined;
  const senderName = from
    ? [from.first_name, from.last_name].filter(Boolean).join(" ") || (from.username as string) || null
    : null;

  const messageDate = message.date as number;
  const defaultDate = messageDate
    ? new Date(messageDate * 1000).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  // Check for duplicate
  const { data: existing } = await supabase
    .from("lawyer_reports")
    .select("id")
    .eq("telegram_message_id", messageId)
    .eq("chat_id", chatId)
    .maybeSingle();

  if (existing) return new Response("OK", { status: 200 });

  // Parse the report
  const { date: parsedDate, tasks } = parseReport(text);
  const reportDate = parsedDate || defaultDate;

  // Save report
  const { data: report, error: reportError } = await supabase
    .from("lawyer_reports")
    .insert({
      telegram_message_id: messageId,
      chat_id: chatId,
      report_date: reportDate,
      sender_id: senderId || null,
      sender_name: senderName,
      raw_text: text,
    })
    .select("id")
    .single();

  if (reportError || !report) {
    console.error("Failed to insert report:", reportError);
    return new Response("Error", { status: 500 });
  }

  // Save tasks
  if (tasks.length > 0) {
    const taskRows = tasks.map(t => ({
      report_id: report.id,
      report_date: reportDate,
      category: t.category,
      client_name: t.client_name,
      task_description: t.task_description,
      time_minutes: t.time_minutes,
      is_completed: t.is_completed,
      source: "telegram_bot",
      raw_line: t.raw_line,
    }));

    const { error: tasksError } = await supabase.from("lawyer_tasks").insert(taskRows);
    if (tasksError) console.error("Failed to insert tasks:", tasksError);
  }

  return new Response(JSON.stringify({ ok: true, report_id: report.id, tasks: tasks.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
