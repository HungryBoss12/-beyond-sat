import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";
import type { ReviewRating, UserCardState } from "./types";

const scheduler = fsrs();

export function emptyFsrsState(): Omit<UserCardState, "id" | "user_id" | "card_id"> {
  const card = createEmptyCard(new Date());
  return fromFsrsCard(card);
}

export function toFsrsCard(row: UserCardState): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export function fromFsrsCard(card: Card): Omit<UserCardState, "id" | "user_id" | "card_id"> {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function ratingToGrade(rating: ReviewRating): Grade {
  const map: Record<ReviewRating, Grade> = {
    1: Rating.Again,
    2: Rating.Hard,
    3: Rating.Good,
    4: Rating.Easy,
  };
  return map[rating];
}

export function previewIntervals(row: UserCardState): Record<ReviewRating, string> {
  const card = toFsrsCard(row);
  const now = new Date();
  const preview = scheduler.repeat(card, now);
  return {
    1: formatInterval(preview[Rating.Again].card.due, now),
    2: formatInterval(preview[Rating.Hard].card.due, now),
    3: formatInterval(preview[Rating.Good].card.due, now),
    4: formatInterval(preview[Rating.Easy].card.due, now),
  };
}

export function applyReview(
  row: UserCardState,
  rating: ReviewRating,
): Omit<UserCardState, "id" | "user_id" | "card_id"> {
  const card = toFsrsCard(row);
  const result = scheduler.next(card, new Date(), ratingToGrade(rating));
  return fromFsrsCard(result.card);
}

/** Human-readable interval for rating button labels. */
export function formatInterval(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime();
  if (ms <= 0) return "<1m";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `<${Math.max(1, minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1h" : `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? "1d" : `${days}d`;
  const months = Math.round(days / 30);
  return months === 1 ? "1mo" : `${months}mo`;
}

export { scheduler, Rating, State };
