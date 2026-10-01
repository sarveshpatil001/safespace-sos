import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const updateProfile = useMutation(api.contacts.updateProfile);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Profile &amp; settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How you appear in emergency notifications sent to your trusted
            contacts.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-safety/10 text-safety">
                  <UserRound className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Your details</CardTitle>
                  <CardDescription>
                    Trusted contacts see this when an emergency is raised
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Display name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-phone">Phone (optional)</Label>
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+351 912 345 678"
                  inputMode="tel"
                />
                <p className="text-xs text-muted-foreground">
                  Included in notification emails so contacts can call you back.
                </p>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Save changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">
                  {user?.email ?? "Guest session"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="secondary" className="capitalize">
                  {user?.role ?? "user"}
                </Badge>
              </div>
              <p className="rounded-lg bg-secondary/60 p-3 text-xs leading-5 text-muted-foreground">
                Sessions are managed by your platform authentication and expire
                automatically. We never store passwords — sign-in uses a
                one-time email code.
              </p>
            </CardContent>
          </Card>

          <Card className="border-safety/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-safety/10 text-safety">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Safety notes</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>
                SafeSpace is a companion, not a replacement for emergency
                services. In immediate danger, call your local emergency number
                first.
              </p>
              <p>
                Location is only captured while an emergency event is open —
                never in the background.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
