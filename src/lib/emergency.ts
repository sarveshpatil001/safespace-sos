/**
 * Emergency event lifecycle state machine.
 *
 *     CREATED ──▶ ACTIVE ──▶ RESOLVED
 *         │          │
 *         └────▶ CANCELLED
 *
 * Terminal states: RESOLVED, CANCELLED. Once terminal, an event can never go
 * back to active — this prevents contradictory statuses. A NEW event is
 * created for a later emergency.
 *
 * This module is shared client + server (pure functions, no Convex imports)
 * so the same rules run in the UI and in the backend mutations.
 */

export type EventStatus = "CREATED" | "ACTIVE" | "RESOLVED" | "CANCELLED";
export type LocationStatus =
  | "PENDING"
  | "AVAILABLE"
  | "DENIED"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "UNSUPPORTED";
export type NotificationStatus =
  | "PENDING"
  | "SENT"
  | "PARTIAL"
  | "FAILED"
  | "NOT_CONFIGURED"
  | "NO_CHANNELS";

export const TERMINAL_STATUSES: readonly EventStatus[] = ["RESOLVED", "CANCELLED"];

export function isTerminal(status: EventStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isLive(status: EventStatus): boolean {
  return status === "CREATED" || status === "ACTIVE";
}

const TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  CREATED: ["ACTIVE", "RESOLVED", "CANCELLED"],
  ACTIVE: ["RESOLVED", "CANCELLED"],
  RESOLVED: [],
  CANCELLED: [],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Human-readable wording for the truthful status system. */
export const STATUS_LABELS: Record<EventStatus, string> = {
  CREATED: "Recorded",
  ACTIVE: "Active",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
};

export const LOCATION_LABELS: Record<LocationStatus, string> = {
  PENDING: "Waiting for location permission",
  AVAILABLE: "Location available",
  DENIED: "Location permission denied",
  TIMEOUT: "Location timed out",
  UNAVAILABLE: "Location unavailable",
  UNSUPPORTED: "Location not supported on this device",
};

export const NOTIFICATION_LABELS: Record<NotificationStatus, string> = {
  PENDING: "Notification not yet attempted",
  SENT: "Notification request accepted by provider",
  PARTIAL: "Some notifications accepted, some failed",
  FAILED: "Notifications could not be sent",
  NOT_CONFIGURED: "Notification provider not configured",
  NO_CHANNELS: "No active contacts with an enabled channel",
};
