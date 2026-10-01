import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Siren,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

const EVENT_LABELS: Record<string, { label: string; className: string }> = {
  CREATED: { label: "Recorded", className: "bg-secondary text-secondary-foreground" },
  ACTIVE: { label: "Active", className: "bg-safety text-safety-foreground" },
  RESOLVED: { label: "Resolved", className: "bg-trust/15 text-trust" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

const LOCATION_LABELS: Record<string, string> = {
  PENDING: "Waiting for permission",
  AVAILABLE: "Location available",
  DENIED: "Permission denied",
  TIMEOUT: "Timed out",
  UNAVAILABLE: "Unavailable",
  UNSUPPORTED: "Not supported",
};

const NOTIF_LABELS: Record<string, string> = {
  PENDING: "Not attempted",
  SENT: "Accepted by provider",
  PARTIAL: "Partially accepted",
  FAILED: "Failed",
  NOT_CONFIGURED: "Provider not configured",
  NO_CHANNELS: "No active contacts with a channel",
};

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function History() {
  const [selectedId, setSelectedId] = useState<Id<"emergencyEvents"> | null>(
    null,
  );
  const events = useQuery(api.events.listEvents, { limit: 100 });
  const selected = useQuery(
    api.events.getEvent,
    selectedId ? { id: selectedId } : "skip",
  );
  const attempts = useQuery(
    api.notifications.listAttempts,
    selectedId ? { eventId: selectedId } : "skip",
  );
  const closeEvent = useMutation(api.events.closeEvent);

  const handleReopen = async (eventId: Id<"emergencyEvents">, resolution: "RESOLVED" | "CANCELLED") => {
    try {
      await closeEvent({ eventId, resolution });
      toast.success(
        resolution === "RESOLVED"
          ? "Marked as resolved."
          : "Marked as cancelled.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Emergency history
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every event SafeSpace recorded, with the honest outcome of each
            notification attempt.
          </p>
        </div>

        {events === undefined ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <Card className="mt-8 border-dashed">
            <CardContent className="py-14 text-center text-sm text-muted-foreground">
              No emergencies recorded. That&apos;s the best possible history.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 space-y-3">
            {events.map((event) => {
              const badge = EVENT_LABELS[event.status] ?? {
                label: event.status,
                className: "",
              };
              return (
                <Card
                  key={event._id}
                  className="cursor-pointer transition-colors hover:border-safety/40"
                  onClick={() => setSelectedId(event._id)}
                >
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                        <Siren className="size-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {formatDateTime(event.createdAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.resolutionReason ??
                            (event.status === "ACTIVE" || event.status === "CREATED"
                              ? "Event still open"
                              : "Outcome recorded")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="gap-1 text-[11px]"
                      >
                        <MapPin className="size-3" />
                        {LOCATION_LABELS[event.locationStatus] ??
                          event.locationStatus}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px]">
                        {NOTIF_LABELS[event.notificationStatus] ??
                          event.notificationStatus}
                      </Badge>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog
        open={selectedId !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Emergency details</DialogTitle>
                <DialogDescription>
                  {formatDateTime(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="mt-1 font-medium">
                      {EVENT_LABELS[selected.status]?.label ?? selected.status}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Event ID</p>
                    <p className="mt-1 break-all font-mono text-xs">
                      {selected._id}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="mt-1 font-medium">
                      {LOCATION_LABELS[selected.locationStatus] ??
                        selected.locationStatus}
                    </p>
                    {selected.latitude !== undefined && (
                      <a
                        className="mt-1 inline-block text-xs font-medium text-safety underline underline-offset-2"
                        href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in Google Maps
                      </a>
                    )}
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Notifications</p>
                    <p className="mt-1 font-medium">
                      {NOTIF_LABELS[selected.notificationStatus] ??
                        selected.notificationStatus}
                    </p>
                  </div>
                </div>

                {selected.resolvedAt && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Closed</p>
                    <p className="mt-1 font-medium">
                      {formatDateTime(selected.resolvedAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selected.resolutionReason}
                    </p>
                  </div>
                )}

                <Separator />

                <div>
                  <p className="text-sm font-medium">
                    Notification attempts
                  </p>
                  {attempts === undefined ? (
                    <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
                  ) : attempts.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No attempts were recorded for this event.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {attempts.map((attempt) => (
                        <li
                          key={attempt._id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                        >
                          <div>
                            <p className="font-medium">{attempt.contactName}</p>
                            <p className="text-xs text-muted-foreground">
                              via {attempt.channel}
                              {attempt.detail ? ` — ${attempt.detail}` : ""}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-xs font-semibold ${
                              attempt.status === "SENT"
                                ? "text-trust"
                                : attempt.status === "FAILED"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {attempt.status === "SENT"
                              ? "SENT"
                              : attempt.status === "FAILED"
                                ? "FAILED"
                                : "NOT CONFIGURED"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {(selected.status === "ACTIVE" ||
                  selected.status === "CREATED") && (
                  <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReopen(selected._id, "RESOLVED")}
                    >
                      <CheckCircle2 className="mr-2 size-4 text-trust" />
                      Mark resolved
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReopen(selected._id, "CANCELLED")}
                    >
                      <XCircle className="mr-2 size-4" />
                      Mark cancelled
                    </Button>
                  </div>
                )}

                <p className="flex items-start gap-1.5 rounded-lg bg-secondary/60 p-3 text-xs leading-5 text-muted-foreground">
                  <Clock className="mt-0.5 size-3.5 shrink-0" />
                  Times are shown in your local timezone. &ldquo;Accepted by
                  provider&rdquo; means the email provider confirmed receipt of
                  the message — it is not a guaranteed-read confirmation.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
