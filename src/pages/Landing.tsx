import { motion } from "framer-motion";
import {
  BadgeCheck,
  Bell,
  Check,
  ChevronDown,
  HeartHandshake,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const HOW_IT_WORKS = [
  {
    icon: Bell,
    title: "Press SOS",
    body: "One large button, always in reach. Confirming takes a deliberate two-step tap so an emergency is never triggered by accident.",
  },
  {
    icon: MapPin,
    title: "Your location is shared",
    body: "With your permission, SafeSpace captures your GPS position and keeps it fresh while the emergency is open — automatically, every 30 seconds.",
  },
  {
    icon: HeartHandshake,
    title: "Your people are notified",
    body: "Your trusted contacts receive your message, your live location link, and the time the emergency started — by email today, SMS as a provider is added.",
  },
  {
    icon: Phone,
    title: "112 is one tap away",
    body: "A direct call action to your local emergency number, alongside everything SafeSpace has already recorded for you.",
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Two-tap SOS, zero fumbling",
    body: "A deliberate confirm step keeps the button fast when it matters and safe when it doesn't.",
  },
  {
    icon: MapPin,
    title: "Live location sharing",
    body: "Optional live sharing generates a private link contacts can follow — updated continuously, revoked the moment you close the event.",
  },
  {
    icon: Bell,
    title: "Truthful notifications",
    body: "You see exactly what happened: accepted, failed, or not yet attempted. No false 'delivered' claims, ever.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Location history is only kept for events you raise. Nothing is tracked in the background, ever.",
  },
  {
    icon: BadgeCheck,
    title: "Full event history",
    body: "Every emergency is recorded with its timeline, notification attempts, and outcome — reviewable anytime.",
  },
  {
    icon: HeartHandshake,
    title: "Built for real life",
    body: "Handles denied permissions, offline moments, and patchy coverage gracefully instead of pretending otherwise.",
  },
];

const FAQS = [
  {
    q: "Does SafeSpace replace calling 112?",
    a: "No. SafeSpace works alongside your local emergency services. It alerts your trusted contacts and gives you a direct 112 call action — it does not place the call for you, and closing an event never cancels a call you have already placed.",
  },
  {
    q: "Who can see my location?",
    a: "Only you and the trusted contacts you choose, via the private link generated for that emergency. The link only works while the emergency is active, is revoked when you close it, and can be revoked manually at any time.",
  },
  {
    q: "What if I deny location permission?",
    a: "The emergency is still recorded and your contacts are still notified — we simply tell everyone honestly that a location wasn't available, and why.",
  },
  {
    q: "How do notifications actually work?",
    a: "Email notifications are sent through a real provider when configured. If a provider isn't set up yet, SafeSpace marks the notification as 'not configured' rather than claiming it was sent. You always see the true state of every attempt.",
  },
];

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const primaryCta = () => {
    if (isAuthenticated) navigate("/dashboard");
    else navigate("/auth");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-screen flex-col"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/logo.svg"
              alt="SafeSpace"
              className="size-8 rounded-lg"
            />
            <span className="text-[15px] font-semibold tracking-tight">
              SafeSpace
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#privacy" className="transition-colors hover:text-foreground">
              Privacy
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {!isLoading && isAuthenticated ? (
              <Button size="sm" onClick={primaryCta}>
                Open SafeSpace
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="hidden sm:inline-flex"
                  onClick={primaryCta}
                >
                  Sign in
                </Button>
                <Button size="sm" onClick={primaryCta}>
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="dot-grid relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 md:pt-24 lg:grid-cols-2">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-safety/30 bg-safety/10 px-3 py-1 text-xs font-medium text-safety">
                <ShieldCheck className="size-3.5" />
                Personal safety, one tap away
              </span>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl md:text-[3.4rem]">
                When every second counts,
                <br />
                <span className="text-safety">one tap</span> is all you should
                need.
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-7 text-muted-foreground">
                SafeSpace alerts the people you trust, shares your location, and
                keeps a clear record — so that getting from “I need help” to
                “someone knows” takes seconds, not minutes.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={primaryCta} className="h-12 px-6 text-[15px]">
                  Create your SafeSpace
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-6 text-[15px]"
                  onClick={() =>
                    document
                      .getElementById("how-it-works")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  See how it works
                </Button>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="size-3.5 text-trust" />
                Free to use
                <span aria-hidden className="text-border">•</span>
                <Check className="size-3.5 text-trust" />
                No location tracking in the background
                <span aria-hidden className="text-border">•</span>
                <Check className="size-3.5 text-trust" />
                Your data, your control
              </p>
            </motion.div>
          </div>

          {/* Hero visual — SOS card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="relative mx-auto w-full max-w-sm"
          >
            <div className="rounded-3xl border border-border/70 bg-card p-8 shadow-xl shadow-foreground/[0.04]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/logo.svg" alt="" className="size-7 rounded-lg" />
                  <span className="text-sm font-medium">SafeSpace</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-trust/10 px-2.5 py-1 text-[11px] font-medium text-trust">
                  <span className="size-1.5 rounded-full bg-trust" />
                  Ready
                </span>
              </div>
              <div className="mt-10 flex flex-col items-center">
                <button
                  type="button"
                  aria-label="Example SOS button (demo only)"
                  className="animate-sos-pulse flex size-36 items-center justify-center rounded-full bg-safety text-lg font-bold tracking-widest text-safety-foreground shadow-lg transition-transform active:scale-95"
                >
                  SOS
                </button>
                <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
                  Hold nothing. Press once, confirm, and everyone you trust is
                  on their way to knowing.
                </p>
              </div>
              <div className="mt-8 space-y-2.5 border-t border-border/60 pt-6 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <MapPin className="size-3.5 text-trust" />
                    Shared live
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contacts</span>
                  <span className="font-medium">3 notified</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">112 call</span>
                  <span className="font-medium">One tap away</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section id="how-it-works" className="border-t border-border/60 py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp}>
            <p className="text-sm font-medium text-safety">How it works</p>
            <h2 className="mt-2 max-w-lg text-3xl font-semibold tracking-tight">
              From “I need help” to “help knows” in four steps
            </h2>
          </motion.div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.08 }}
                className="relative rounded-2xl border border-border/60 bg-card p-6"
              >
                <span className="absolute right-5 top-5 text-xs font-semibold text-muted-foreground/50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex size-10 items-center justify-center rounded-xl bg-safety/10 text-safety">
                  <step.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Features                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section id="features" className="border-t border-border/60 py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp}>
            <p className="text-sm font-medium text-safety">Features</p>
            <h2 className="mt-2 max-w-lg text-3xl font-semibold tracking-tight">
              Everything built around one honest promise
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-7 text-muted-foreground">
              SafeSpace never tells you something worked when it didn&apos;t.
              Every status you see reflects what actually happened — that trust
              is the whole point.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: (i % 3) * 0.08 }}
                className="rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-safety/40"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {f.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Privacy                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section id="privacy" className="border-t border-border/60 py-20">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <p className="text-sm font-medium text-safety">Privacy</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Your location is yours. Full stop.
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-7 text-muted-foreground">
              SafeSpace only requests your location during an emergency you
              start. There is no background tracking, no selling of data, and no
              location history beyond the events you raise.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "Location only during events",
                "Private, revocable share links",
                "No data selling",
                "Delete events anytime",
              ].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  <Check className="size-3 text-trust" />
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
          <motion.div {...fadeUp} className="relative">
            <div className="rounded-3xl border border-border/70 bg-card p-8 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-trust/10 text-trust">
                  <Lock className="size-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold">
                    Private by design
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    Your emergency record contains only what you shared: the
                    time it started, the location you allowed, and the
                    notifications that were actually attempted.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-safety/10 text-safety">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold">
                    Honest about limits
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    If a contact can&apos;t be reached, or a provider is
                    offline, SafeSpace says so plainly. Ambiguity is worse than
                    bad news in an emergency.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FAQ                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section id="faq" className="border-t border-border/60 py-20">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="text-center">
            <p className="text-sm font-medium text-safety">FAQ</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Straight answers
            </h2>
          </motion.div>
          <div className="mt-10 divide-y divide-border/60 border-y border-border/60">
            {FAQS.map((faq, i) => (
              <div key={faq.q}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span className="text-[15px] font-medium">{faq.q}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <p className="pb-5 pr-8 text-sm leading-6 text-muted-foreground">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border/60 py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <motion.div
            {...fadeUp}
            className="dot-grid relative overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-16 text-center sm:px-12"
          >
            <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight">
              Set it up today, so it&apos;s ready when it matters.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-7 text-muted-foreground">
              Add your trusted contacts once. From then on, help is one
              deliberate tap away.
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 px-8 text-[15px]"
              onClick={primaryCta}
            >
              {isAuthenticated ? "Open SafeSpace" : "Create your SafeSpace"}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="" className="size-6 rounded-md" />
            <span className="text-sm font-medium">SafeSpace</span>
          </div>
          <p className="max-w-md text-center text-xs leading-5 text-muted-foreground sm:text-right">
            SafeSpace complements — never replaces — your local emergency
            services. In immediate danger, always call your local emergency
            number first.
          </p>
        </div>
      </footer>
    </motion.div>
  );
}
