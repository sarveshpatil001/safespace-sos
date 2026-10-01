import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Info, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel";

interface ContactFormState {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  active: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
}

const EMPTY_FORM: ContactFormState = {
  name: "",
  relationship: "",
  phone: "",
  email: "",
  active: true,
  notifyEmail: true,
  notifySms: true,
};

export default function Contacts() {
  const contacts = useQuery(api.contacts.listContacts);
  const createContact = useMutation(api.contacts.createContact);
  const updateContact = useMutation(api.contacts.updateContact);
  const setContactActive = useMutation(api.contacts.setContactActive);
  const deleteContact = useMutation(api.contacts.deleteContact);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"trustedContacts"> | null>(null);
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"trustedContacts"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (contact: Doc<"trustedContacts">) => {
    setEditingId(contact._id);
    setForm({
      name: contact.name,
      relationship: contact.relationship ?? "",
      phone: contact.phone,
      email: contact.email ?? "",
      active: contact.active,
      notifyEmail: contact.notifyEmail,
      notifySms: contact.notifySms,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required";
    const digits = form.phone.replace(/[\s\-().]/g, "").replace(/^\+/, "");
    if (!/^\d{7,15}$/.test(digits)) {
      next.phone = "Enter 7–15 digits, optionally starting with +";
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (form.notifyEmail && !form.email.trim()) {
      next.email = "Email is needed for email notifications";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        relationship: form.relationship.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        active: form.active,
        notifyEmail: form.notifyEmail,
        notifySms: form.notifySms,
      };
      if (editingId) {
        await updateContact({ id: editingId, ...payload });
        toast.success("Contact updated");
      } else {
        await createContact(payload);
        toast.success("Contact added");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (contact: Doc<"trustedContacts">) => {
    try {
      await setContactActive({ id: contact._id, active: !contact.active });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteContact({ id: deleteTarget._id });
      toast.success("Contact deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Trusted contacts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The people SafeSpace notifies when you raise an emergency. Only
              active contacts are included.
            </p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="mr-2 size-4" />
            Add contact
          </Button>
        </div>

        {contacts === undefined ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
        ) : contacts.length === 0 ? (
          <Card className="mt-8 border-dashed">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
                <UserRound className="size-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium">No contacts yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add at least one person you trust. When you press SOS they
                receive your message and location.
              </p>
              <Button className="mt-6" onClick={openAdd}>
                <Plus className="mr-2 size-4" />
                Add your first contact
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contacts.map((contact) => (
              <Card
                key={contact._id}
                className={!contact.active ? "opacity-60" : undefined}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-safety/10 text-sm font-semibold text-safety">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">
                          {contact.name}
                        </p>
                        {contact.relationship && (
                          <p className="text-xs text-muted-foreground">
                            {contact.relationship}
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={contact.active}
                      onCheckedChange={() => handleToggleActive(contact)}
                      aria-label={`Mark ${contact.name} ${contact.active ? "inactive" : "active"}`}
                    />
                  </div>

                  <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                    <p>{contact.phone}</p>
                    {contact.email && <p>{contact.email}</p>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {contact.notifyEmail && (
                      <Badge variant="secondary" className="text-[11px]">
                        Email
                      </Badge>
                    )}
                    {contact.notifySms && (
                      <Badge variant="secondary" className="text-[11px]">
                        SMS
                      </Badge>
                    )}
                    {!contact.active && (
                      <Badge variant="outline" className="text-[11px]">
                        Inactive
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2 border-t border-border/60 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEdit(contact)}
                    >
                      <Pencil className="mr-2 size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(contact)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {contacts && contacts.length > 0 && (
          <p className="mt-6 flex items-start gap-2 rounded-lg bg-secondary/60 p-3 text-xs leading-5 text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            SMS notifications are prepared but no SMS provider is connected in
            this deployment yet — SMS attempts are always recorded as
            &ldquo;not configured&rdquo;, never as sent. Email notifications
            send through a real provider when the integration key is present.
          </p>
        )}
      </div>

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit contact" : "Add trusted contact"}
            </DialogTitle>
            <DialogDescription>
              This person will be notified when you raise an emergency. Use
              someone you trust to check on you quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Maria Silva"
                maxLength={80}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-rel">Relationship (optional)</Label>
              <Input
                id="contact-rel"
                value={form.relationship}
                onChange={(e) =>
                  setForm({ ...form, relationship: e.target.value })
                }
                placeholder="Sister, friend, flatmate…"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+351 912 345 678"
                inputMode="tel"
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email (optional)</Label>
              <Input
                id="contact-email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
                type="email"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-3 rounded-lg border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify-email" className="text-sm">
                    Email notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Sends through a real provider when configured
                  </p>
                </div>
                <Switch
                  id="notify-email"
                  checked={form.notifyEmail}
                  onCheckedChange={(v) => setForm({ ...form, notifyEmail: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify-sms" className="text-sm">
                    SMS notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Prepared — no provider connected yet
                  </p>
                </div>
                <Switch
                  id="notify-sms"
                  checked={form.notifySms}
                  onCheckedChange={(v) => setForm({ ...form, notifySms: v })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
              <div>
                <Label htmlFor="contact-active" className="text-sm">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inactive contacts are skipped during emergencies
                </p>
              </div>
              <Switch
                id="contact-active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be notified during emergencies. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep contact</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
