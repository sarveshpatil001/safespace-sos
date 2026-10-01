import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, Siren, UserRound, Users } from "lucide-react";

const LOCATION_LABELS: Record<string, string> = {
  PENDING: "Pending",
  AVAILABLE: "Available",
  DENIED: "Denied",
  TIMEOUT: "Timed out",
  UNAVAILABLE: "Unavailable",
  UNSUPPORTED: "Unsupported",
};

const NOTIF_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SENT: "Accepted",
  PARTIAL: "Partial",
  FAILED: "Failed",
  NOT_CONFIGURED: "Not configured",
  NO_CHANNELS: "No channels",
};

function fmt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Admin() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const stats = useQuery(api.admin.adminStats, isAdmin ? {} : "skip");
  const users = useQuery(api.admin.adminListUsers, isAdmin ? {} : "skip");
  const events = useQuery(api.admin.adminListEvents, isAdmin ? {} : "skip");
  const audit = useQuery(api.admin.adminListAudit, isAdmin ? {} : "skip");

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <Card>
            <CardContent className="flex flex-col items-center py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
                <ShieldAlert className="size-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium">
                Admin access required
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                This area is only available to workspace administrators.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-safety/10 text-safety">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin area</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Organization-wide overview. Personal location details stay hidden
              here by design.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Users",
              value: stats?.totalUsers,
              icon: Users,
            },
            {
              label: "Emergencies recorded",
              value: stats?.totalEvents,
              icon: Siren,
            },
            {
              label: "Active right now",
              value: stats?.activeEvents,
              icon: ShieldAlert,
            },
            {
              label: "Trusted contacts",
              value: stats?.totalContacts,
              icon: UserRound,
            },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-secondary">
                    <s.icon className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {s.value ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users */}
        <h2 className="mt-10 text-lg font-semibold">Users</h2>
        <Card className="mt-3 overflow-x-auto">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u) => (
                  <TableRow key={u._id}>
                    <TableCell className="font-medium">
                      {u.name ?? "—"}
                    </TableCell>
                    <TableCell>{u.email ?? "—"}</TableCell>
                    <TableCell>{u.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px]">
                        {u.isAnonymous ? "Guest" : "Registered"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmt(u._creationTime)}
                    </TableCell>
                  </TableRow>
                ))}
                {users?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Events */}
        <h2 className="mt-10 text-lg font-semibold">Emergency events</h2>
        <Card className="mt-3 overflow-x-auto">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Notifications</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(events ?? []).map((e) => (
                  <TableRow key={e._id}>
                    <TableCell>{fmt(e.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.userId.slice(-8)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          e.status === "ACTIVE"
                            ? "bg-safety text-safety-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }
                      >
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {LOCATION_LABELS[e.locationStatus] ?? e.locationStatus}
                    </TableCell>
                    <TableCell>
                      {NOTIF_LABELS[e.notificationStatus] ??
                        e.notificationStatus}
                    </TableCell>
                  </TableRow>
                ))}
                {events?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No emergencies recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Audit log */}
        <h2 className="mt-10 text-lg font-semibold">Audit log</h2>
        <Card className="mt-3 overflow-x-auto">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(audit ?? []).map((a) => (
                  <TableRow key={a._id}>
                    <TableCell className="text-muted-foreground">
                      {fmt(a.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {a.action}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          a.result === "FAILED"
                            ? "text-destructive"
                            : a.result === "SUCCESS"
                              ? "text-trust"
                              : ""
                        }
                      >
                        {a.result ?? "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {audit?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No audit entries yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
