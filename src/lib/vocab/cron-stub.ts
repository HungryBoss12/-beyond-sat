/**
 * Phase 2 — Telegram reminder cron (deferred).
 *
 * When enabled, add to wrangler.jsonc:
 *   "triggers": { "crons": ["0 15 * * *"] }
 * And wire POST /api/crons/reminder-notifications in server.ts to:
 * - Query users with last_active_at before today and due vocab cards
 * - Send Telegram Bot API messages to telegram_chat_id
 */

export {};
