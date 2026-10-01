import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.svg";
import { Loader2, MapPin, Navigation, ShieldAlert } from "lucide-react";
import { Link, useParams } from "react-router";

function fmt(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Share() {
  const { token } = useParams<{ token: string }>();
  const share = useQuery(
    api.events.shareByToken,
    token ? { token } : "skip",
  );

  const mapsUrl =
    share?.latitude !== undefined && share?.longitude !== undefined
      ? `https://www.google.com/maps?q=${share.latitude},${share.longitude}`
      : null;

  return (
    <div className="dot-grid flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2.5">
        <img src={logo} alt="SafeSpace" className="size-9 rounded-lg" />
        <span className="text-[15px] font-semibold tracking-tight">
          SafeSpace
        </span>
      </Link>

      {share === undefined ? (
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking live link…
          </CardContent>
        </Card>
      ) : share === null ? (
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
              <ShieldAlert className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">Link not available</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              This live location link has been revoked, has expired, or never
              existed. Ask the person who shared it for a new link.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/">Go to SafeSpace</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md border-safety/40 shadow-lg">
          <CardContent className="py-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-safety/10">
              <Navigation className="size-7 animate-breathe text-safety" />
            </div>
            <h1 className="mt-5 text-xl font-semibold tracking-tight">
              {share.userName ?? "Someone you trust"}{" "}
              raised an emergency
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This page updates automatically while the emergency is active.
              It stopped working the moment the event was closed.
            </p>

            <div className="mt-6 space-y-2.5 rounded-xl border border-border/60 p-4 text-left text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Emergency started</span>
                <span className="font-medium">{fmt(share.startedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last update</span>
                <span className="font-medium">{fmt(share.lastPingAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  className={
                    share.status === "ACTIVE"
                      ? "bg-safety text-safety-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }
                >
                  {share.status === "CREATED" ? "Recorded" : share.status}
                </Badge>
              </div>
            </div>

            {mapsUrl ? (
              <div className="mt-5 rounded-xl border border-border/60 p-4 text-left">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="size-4 text-safety" />
                  Last known location
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {share.latitude?.toFixed(5)}, {share.longitude?.toFixed(5)}
                  {share.accuracy
                    ? ` · ±${Math.round(share.accuracy)}m accuracy`
                    : ""}
                </p>
                <Button asChild className="mt-3 w-full">
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    Open in Google Maps
                  </a>
                </Button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  If you believe there is immediate danger to life, contact
                  your local emergency number (112 in the EU).
                </p>
              </div>
            ) : (
              <p className="mt-5 rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">
                No location has been shared yet for this emergency
                {share.locationStatus === "DENIED"
                  ? " — the person declined to share their location."
                  : share.locationStatus === "PENDING"
                    ? " — waiting for their device."
                    : "."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <p className="mt-6 max-w-sm text-center text-xs leading-5 text-muted-foreground">
        This link was shared only with trusted contacts. It shows the minimum
        needed to help — nothing more.
      </p>
    </div>
  );
}
