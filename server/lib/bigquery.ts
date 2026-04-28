import { BigQuery } from "@google-cloud/bigquery";

const DATASET = process.env.BIGQUERY_DATASET ?? "kreasi_analytics";
const PROJECT = process.env.GCP_PROJECT_ID;

let bq: BigQuery | null = null;
try {
  bq = new BigQuery({ projectId: PROJECT });
} catch (err) {
  console.warn("[BigQuery] Client init failed — analytics disabled:", err);
}

function insert(table: string, rows: Record<string, unknown>[]): void {
  if (!bq) return;
  bq.dataset(DATASET).table(table).insert(rows).catch(err => {
    console.error(`[BigQuery] insert error (${table}):`, err?.errors?.[0]?.errors ?? err?.message ?? err);
  });
}

export function bqTrackCost(data: {
  phone?: string; service: string; operation: string; model?: string;
  costUsd: number; inputTokens?: number; outputTokens?: number; metadata?: string | null;
}): void {
  insert("api_costs", [{
    phone: data.phone ?? null, service: data.service, operation: data.operation,
    model: data.model ?? null, cost_usd: data.costUsd,
    input_tokens: data.inputTokens ?? null, output_tokens: data.outputTokens ?? null,
    metadata: data.metadata ?? null, logged_at: { value: new Date().toISOString() },
  }]);
}

export function bqTrackPayment(data: {
  externalId: string; phone: string; packageName: string;
  credits: number; amountIdr: number; currency: string; paidAt?: string;
}): void {
  insert("payments", [{
    external_id: data.externalId, phone: data.phone, package_name: data.packageName,
    credits: data.credits, amount_idr: data.amountIdr, currency: data.currency,
    paid_at: { value: data.paidAt ?? new Date().toISOString() },
  }]);
}

export function bqTrackUserCredit(phone: string, credits: number): void {
  insert("user_credits", [{ phone, credits, updated_at: { value: new Date().toISOString() } }]);
}

export function bqTrackWhatsApp(data: { phone: string; eventType: "otp_sent" | "login" }): void {
  insert("whatsapp_events", [{
    phone: data.phone, event_type: data.eventType, occurred_at: { value: new Date().toISOString() },
  }]);
}

export function bqTrackProject(data: {
  projectId: string; phone: string; stage: string; theme?: string; status: string;
}): void {
  insert("projects", [{
    project_id: data.projectId, phone: data.phone, stage: data.stage,
    theme: data.theme ?? null, status: data.status,
    tracked_at: { value: new Date().toISOString() },
  }]);
}
