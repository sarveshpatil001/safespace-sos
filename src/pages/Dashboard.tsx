import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  History,
  MapPin,
  Phone,
  PhoneCall,
  ShieldCheck,
  Siren,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

type GeoStatus =
  | "PENDING"
  | "AVAILABLE"
  | "DENIED"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "UNSUPPORTED";

const GEO_MESSAGES: Record<GeoStatus, string> = {
  PENDING: "Waiting for location…",
  AVAILABLE: "Location captured",
  DENIED: "Location permission denied",
  TIMEOUT: "Location request timed out",
  UNAVAILABLE: "Location unavailable on this device",
  UNSUPPORTED: "This browser does not support geolocation",
};

function formatDuration(fromMs: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - fromMs) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const activeEvent = useQuery(api.events.activeEvent);
  const myContacts = useQuery(api.contacts.listContacts);

  const createEvent = useMutation(api.events.createEvent);
  const setLocation = useMutation(api.events.setLocation);
  const notifyContacts = useMutation(api.notifications.notifyContacts);
  const closeEvent = useMutation(api.events.closeEvent);
  const pingLocation = useMutation(api.events.pingLocation);
  const revokeShare = useMutation(api.events.revokeShare);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("PENDING");
  const [now, setNow] = useState(Date.now());
  const notifiedForEvent = useRef<string | null>(null);

  // Tick every second while an event is live.
  useEffect(() => {
    if (!activeEvent) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeEvent]);

  const captureLocation = useCallback(
    async (eventId: Id<"emergencyEvents">) => {
      if (!("geolocation" in navigator)) {
        setGeoStatus("UNSUPPORTED");
        await setLocation({
          eventId,
          status: "UNSUPPORTED",
        }).catch(() => {});
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setGeoStatus("AVAILABLE");
          try {
            await setLocation({
              eventId,
              status: "AVAILABLE",
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          } catch {
            /* event may have been closed concurrently */
          }
        },
        async (err) => {
          const status: GeoStatus =
            err.code === err.PERMISSION_DENIED
              ? "DENIED"
              : err.code === err.POSITION_UNAVAILABLE
                ? "UNAVAILABLE"
                : "TIMEOUT";
          setGeoStatus(status);
          await setLocation({ eventId, status }).catch(() => {});
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
      );
    },
    [setLocation],
  );

  const handleConfirmSos = async () => {
    setStarting(true);
    setGeoStatus("PENDING");
    try {
      const { eventId } = await createEvent({});
      await captureLocation(eventId);
      await notifyContacts({ eventId });
      notifiedForEvent.current = eventId;
      setConfirmOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start the emergency",
      );
      setConfirmOpen(false);
    } finally {
      setStarting(false);
    }
  };

  // Live pings every 30s while an event is ACTIVE.
  const lastPingSentFor = useRef<string | null>(null);
  useEffect(() => {
    const ev = activeEvent;
    if (!ev || ev.status !== "ACTIVE") return;
    const id = setInterval(
      () => {
        navigator.geolocation?.getCurrentPosition(
          async (pos) => {
            lastPingSentFor.current = ev._id;
            await pingLocation({
              eventId: ev._id,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }).catch(() => {});
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8_000 },
        );
      },
      30_000,
    );
    return () => clearInterval(id);
  }, [activeEvent, pingLocation]);

  const activeContacts = useMemo(
    () => (myContacts ?? []).filter((c) => c.active),
    [myContacts],
  );

  const handleCancel = async () => {
    if (!activeEvent) return;
    try {
      await closeEvent({ eventId: activeEvent._id, resolution: "CANCELLED" });
      toast.success("Emergency closed as false alarm.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close");
    }
  };

  const handleResolve = async () => {
    if (!activeEvent) return;
    try {
      await closeEvent({ eventId: activeEvent._id, resolution: "RESOLVED" });
      toast.success("Emergency marked as resolved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close");
    }
  };

  const handleRevokeShare = async () => {
    if (!activeEvent) return;
    try {
      await revokeShare({ eventId: activeEvent._id });
      toast.success("Live location link revoked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke");
    }
  };

  const shareUrl =
    activeEvent?.liveSharing && activeEvent.shareToken
      ? `${window.location.origin}/share/${activeEvent.shareToken}`
      : null;

  const notificationStatus = activeEvent?.notificationStatus ?? "PENDING";
  const notifLabel: Record<string, string> = {
    PENDING: "Not yet attempted",
    SENT: "Accepted by provider",
    PARTIAL: "Partially accepted",
    FAILED: "Sending failed",
    NOT_CONFIGURED: "Provider not configured",
    NO_CHANNELS: "No active contacts with a channel",
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {activeEvent ? (
          /* -------------------------------------------------------------- */
          /* Active emergency screen                                          */
          /* -------------------------------------------------------------- */
          <div className="space-y-6">
            <Card className="border-safety/40">
              <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-safety/10 text-safety">
                      <Siren className="size-6 animate-breathe" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-safety">
                        Emergency active
                      </CardTitle>
                      <CardDescription>
                        Started{" "}
                        {formatDuration(activeEvent.createdAt)} ago
                        {" · "}
                        {new Date(activeEvent.createdAt).toLocaleTimeString()}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-safety text-safety-foreground">
                    {activeEvent.status === "CREATED" ? "Recorded" : "Active"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="size-4 text-safety" />
                      Location
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {GEO_MESSAGES[activeEvent.locationStatus as GeoStatus] ??
                        activeEvent.locationStatus}
                      {activeEvent.locationStatus === "AVAILABLE" &&
                        activeEvent.latitude !== undefined && (
                          <>
                            {" · "}
                            {activeEvent.latitude.toFixed(4)},{" "}
                            {activeEvent.longitude?.toFixed(4)}
                          </>
                        )}
                    </p>
                    {activeEvent.locationStatus === "AVAILABLE" &&
                      activeEvent.latitude !== undefined && (
                        <a
                          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-safety underline-offset-2 hover:underline"
                          href={`https://www.google.com/maps?q=${activeEvent.latitude},${activeEvent.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open in Google Maps
                        </a>
                      )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="size-4 text-trust" />
                      Trusted contacts
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {notifLabel[notificationStatus] ?? notificationStatus}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      {activeContacts.length} active contact
                      {activeContacts.length === 1 ? "" : "s"} configured
                    </p>
                  </div>
                </div>

                {/* 112 call action */}
                <div className="rounded-xl border border-safety/40 bg-safety/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        Emergency services (112)
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Opens your phone app — you confirm the call yourself.
                        SafeSpace cannot place it for you.
                      </p>
                    </div>
                    <a href="tel:112">
                      <Button className="bg-safety text-safety-foreground hover:bg-safety-hover">
                        <PhoneCall className="mr-2 size-4" />
                        Call 112
                      </Button>
                    </a>
                  </div>
                </div>

                {/* Live share */}
                {shareUrl && (
                  <div className="rounded-xl border border-border/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className="size-2 animate-breathe rounded-full bg-trust" />
                          Live location link
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {shareUrl}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard?.writeText(shareUrl);
                            toast.success("Link copied");
                          }}
                        >
                          <Copy className="mr-2 size-3.5" />
                          Copy
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleRevokeShare}>
                          Revoke
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <Progress value={activeEvent.locationStatus === "AVAILABLE" ? 100 : 60} className="h-1" />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  Location updates are sent every 30 seconds while this page is
                  open.
                </p>

                {/* Closure actions */}
                <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                  <Button variant="outline" onClick={handleResolve}>
                    <CheckCircle2 className="mr-2 size-4 text-trust" />
                    I&apos;m safe — mark resolved
                  </Button>
                  <Button variant="ghost" onClick={handleCancel}>
                    <XCircle className="mr-2 size-4" />
                    False alarm — cancel
                  </Button>
                </div>
                <p className="flex items-start gap-1.5 rounded-lg bg-secondary/60 p-3 text-xs leading-5 text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-safety" />
                  Closing the SafeSpace event does not cancel a 112 call you
                  have already placed. If you contacted emergency services and
                  are now safe, tell them directly.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* -------------------------------------------------------------- */
          /* Idle state: SOS button + overview                               */
          /* -------------------------------------------------------------- */
          <div className="space-y-8">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {user?.name ? `Welcome back, ${user.name}` : "Welcome back"}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                You&apos;re prepared. Stay that way.
              </h1>
            </div>

            <Card className="dot-grid overflow-hidden border-border/70">
              <CardContent className="flex flex-col items-center py-14">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="animate-sos-pulse flex size-44 items-center justify-center rounded-full bg-safety text-2xl font-bold tracking-[0.2em] text-safety-foreground shadow-xl transition-transform hover:scale-[1.02] active:scale-95"
                  aria-label="Start SOS emergency"
                >
                  SOS
                </button>
                <p className="mt-6 max-w-sm text-center text-sm leading-6 text-muted-foreground">
                  Press once, confirm, and SafeSpace records the emergency,
                  shares your location, and notifies your trusted contacts.
                </p>
                {activeContacts.length === 0 && (
                  <p className="mt-4 max-w-sm rounded-lg bg-secondary px-4 py-2.5 text-center text-xs text-muted-foreground">
                    <Link to="/contacts" className="font-medium text-safety underline underline-offset-2">
                      Add a trusted contact
                    </Link>{" "}
                    first — SOS works best when someone can be reached.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              <Link to="/contacts">
                <Card className="h-full transition-colors hover:border-safety/40">
                  <CardContent className="flex items-start gap-3 pt-6">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-safety/10 text-safety">
                      <Phone className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Trusted contacts</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {activeContacts.length} active ·{" "}
                        {(myContacts ?? []).length} total
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link to="/history">
                <Card className="h-full transition-colors hover:border-safety/40">
                  <CardContent className="flex items-start gap-3 pt-6">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                      <History className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Event history</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Review past emergencies and their outcomes
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Card>
                <CardContent className="flex items-start gap-3 pt-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">112 call action</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Included in every emergency, one tap away
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SOS confirm dialog                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-safety">
              <AlertTriangle className="size-5" />
              Confirm emergency
            </DialogTitle>
            <DialogDescription>
              This will immediately record an emergency, request your location,
              and notify your {activeContacts.length} active contact
              {activeContacts.length === 1 ? "" : "s"}. You can close it
              afterwards as resolved or a false alarm.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleConfirmSos}
              disabled={starting}
              className="w-full bg-safety text-safety-foreground hover:bg-safety-hover"
            >
              {starting ? "Starting…" : "Yes — I need help"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setConfirmOpen(false)}
              disabled={starting}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
