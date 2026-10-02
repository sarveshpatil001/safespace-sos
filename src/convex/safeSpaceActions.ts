"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { vly } from "../lib/vly-integrations";
import { internal } from "./_generated/api";

/**
 * Sends one emergency email through the configured provider, then records
 * exactly what the provider reported back into the attempt log.
 *
 * Honesty contract: `SENT` is only ever recorded when the provider accepts the
 * message. If the integration key is missing the attempt is recorded as
 * FAILED with a `not_configured` detail — never as sent.
 */
/** Minimal HTML escaping for user-authored values interpolated into emails. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const sendEmail = internalAction({
  args: {
    eventId: v.id("emergencyEvents"),
    contactId: v.id("trustedContacts"),
    contactName: v.string(),
    to: v.string(),
    userName: v.string(),
    userPhone: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    liveSharing: v.boolean(),
    shareToken: v.optional(v.string()),
    startedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let ok = false;
    let messageId: string | undefined;
    let error: string | undefined;

    if (!process.env.VLY_INTEGRATION_KEY) {
      error = "not_configured: no email provider key available";
    } else {
      const lat = args.latitude;
      const lng = args.longitude;
      const mapsUrl =
        typeof lat === "number" && typeof lng === "number"
          ? `https://www.google.com/maps?q=${lat},${lng}`
          : null;
      const shareUrl =
        args.liveSharing && args.shareToken
          ? `${process.env.CONVEX_SITE_URL ?? ""}/share/${args.shareToken}`
          : null;

      const mapsLine = mapsUrl
        ? `<p><strong>Location:</strong> <a href="${mapsUrl}">Open in Google Maps</a> (${lat!.toFixed(5)}, ${lng!.toFixed(5)})</p>`
        : "<p><strong>Location:</strong> not yet available</p>";
      const shareLine = shareUrl
        ? `<p><strong>Live location:</strong> <a href="${shareUrl}">Follow live updates</a> (updated continuously while the emergency is active)</p>`
        : "<p><strong>Live location:</strong> not enabled for this emergency</p>";
      const safeUserName = escapeHtml(args.userName);
      const phoneLine = args.userPhone
        ? `<p><strong>Phone:</strong> ${escapeHtml(args.userPhone)}</p>`
        : "";

      try {
        const result = await vly.email.send({
          to: args.to,
          subject: `EMERGENCY: ${args.userName} needs help`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
              <div style="background: #b91c1c; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 18px;">EMERGENCY ALERT</h1>
              </div>
              <div style="border: 1px solid #e5e7eb; border-top: 0; padding: 20px; border-radius: 0 0 8px 8px;">
                <p><strong>${safeUserName}</strong> raised an emergency in SafeSpace at
                <strong>${new Date(args.startedAt).toLocaleString()}</strong>.</p>
                ${mapsLine}
                ${shareLine}
                ${phoneLine}                  <p style="margin-top: 16px; font-size: 13px; color: #6b7280;">
                    You are listed as a trusted contact. If you can, reach out to
                    ${safeUserName} now or go to their location. If you believe
                  there is immediate danger to life, contact your local emergency
                  number.
                </p>
              </div>
            </div>
          `,
          text: `EMERGENCY: ${args.userName} needs help. ${mapsUrl ? `Location: ${mapsUrl}` : "Location: not yet available"} ${shareUrl ? `Live: ${shareUrl}` : ""} ${args.userPhone ? `Phone: ${args.userPhone}` : ""}`,
        });

        if (result.success && result.data) {
          ok = true;
          messageId =
            (result.data as { id?: string }).id ?? "accepted-by-provider";
        } else {
          error = result.error ?? "Provider returned no data";
        }
      } catch (err) {
        error = err instanceof Error ? err.message : "Unknown provider error";
      }
    }

    await ctx.runMutation(internal.notifications.recordAttempt, {
      eventId: args.eventId,
      contactId: args.contactId,
      contactName: args.contactName,
      channel: "email",
      status: ok ? "SENT" : "FAILED",
      providerMessageId: messageId,
      detail: error ?? (ok ? "Email request accepted by provider" : undefined),
    });
  },
});
