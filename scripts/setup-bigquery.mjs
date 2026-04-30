#!/usr/bin/env node
/**
 * One-time setup: creates the kreasi_analytics BigQuery dataset and tables.
 * Run once per GCP project:
 *   GCP_PROJECT_ID=gen-lang-client-0550650014 node scripts/setup-bigquery.mjs
 */
import { BigQuery } from "@google-cloud/bigquery";

const DATASET = process.env.BIGQUERY_DATASET ?? "kreasi_analytics";
const PROJECT = process.env.GCP_PROJECT_ID;
const LOCATION = process.env.BQ_LOCATION ?? "asia-southeast2"; // Jakarta

const bq = new BigQuery({ projectId: PROJECT });

async function createDataset() {
  try {
    await bq.createDataset(DATASET, { location: LOCATION });
    console.log(`✅ Dataset created: ${DATASET} (${LOCATION})`);
  } catch (err) {
    if (err.code === 409) console.log(`ℹ️  Dataset already exists: ${DATASET}`);
    else throw err;
  }
}

async function createTable(name, schema, clustering = []) {
  const options = {
    schema,
    timePartitioning: { type: "DAY" },
    ...(clustering.length ? { clustering: { fields: clustering } } : {}),
  };
  try {
    await bq.dataset(DATASET).createTable(name, options);
    console.log(`✅ Table created: ${DATASET}.${name}`);
  } catch (err) {
    if (err.code === 409) console.log(`ℹ️  Table already exists: ${DATASET}.${name}`);
    else throw err;
  }
}

await createDataset();

await createTable("whatsapp_events", [
  { name: "phone",       type: "STRING",    mode: "REQUIRED" },
  { name: "event_type",  type: "STRING",    mode: "REQUIRED" }, // otp_sent | login
  { name: "occurred_at", type: "TIMESTAMP", mode: "REQUIRED" },
], ["event_type"]);

await createTable("payments", [
  { name: "external_id",  type: "STRING",    mode: "REQUIRED" },
  { name: "phone",        type: "STRING",    mode: "REQUIRED" },
  { name: "package_name", type: "STRING",    mode: "REQUIRED" },
  { name: "credits",      type: "INTEGER",   mode: "REQUIRED" },
  { name: "amount_idr",   type: "INTEGER",   mode: "REQUIRED" },
  { name: "currency",     type: "STRING",    mode: "REQUIRED" },
  { name: "paid_at",      type: "TIMESTAMP", mode: "REQUIRED" },
], ["package_name"]);

await createTable("projects", [
  { name: "project_id", type: "STRING",    mode: "REQUIRED" },
  { name: "phone",      type: "STRING",    mode: "REQUIRED" },
  { name: "stage",      type: "STRING",    mode: "REQUIRED" },
  { name: "theme",      type: "STRING",    mode: "NULLABLE" },
  { name: "status",     type: "STRING",    mode: "REQUIRED" },
  { name: "tracked_at", type: "TIMESTAMP", mode: "REQUIRED" },
], ["stage", "status"]);

await createTable("user_credits", [
  { name: "phone",      type: "STRING",    mode: "REQUIRED" },
  { name: "credits",    type: "INTEGER",   mode: "REQUIRED" },
  { name: "updated_at", type: "TIMESTAMP", mode: "REQUIRED" },
]);

await createTable("api_costs", [
  { name: "phone",         type: "STRING",    mode: "NULLABLE" },
  { name: "service",       type: "STRING",    mode: "REQUIRED" },
  { name: "operation",     type: "STRING",    mode: "REQUIRED" },
  { name: "model",         type: "STRING",    mode: "NULLABLE" },
  { name: "cost_usd",      type: "FLOAT",     mode: "REQUIRED" },
  { name: "input_tokens",  type: "INTEGER",   mode: "NULLABLE" },
  { name: "output_tokens", type: "INTEGER",   mode: "NULLABLE" },
  { name: "metadata",      type: "STRING",    mode: "NULLABLE" },
  { name: "logged_at",     type: "TIMESTAMP", mode: "REQUIRED" },
], ["service", "operation"]);

console.log("\n🎉 kreasi_analytics BigQuery setup complete.");
