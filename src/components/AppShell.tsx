import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import {
  ChevronDown,
  History,
  LayoutDashboard,
  LogOut,
  Phone,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/history", label: "History", icon: History },
  { to: "/contacts", label: "Contacts", icon: Phone },
  { to: "/profile", label: "Profile", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <img src={logo} alt="SafeSpace" className="size-8 rounded-lg" />
              <span className="text-[15px] font-semibold tracking-tight">
                SafeSpace
              </span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
              {user?.role === "admin" && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <ShieldCheck className="size-4" />
                  Admin
                </Link>
              )}
            </nav>
          </div>

          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-safety/10 text-xs font-semibold text-safety">
                    {(user?.name ?? user?.email ?? "U").charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[160px] truncate text-sm sm:inline">
                    {user?.name ?? user?.email ?? "Account"}
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {user?.email ?? "Guest session"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <Settings className="mr-2 size-4" />
                  Profile &amp; settings
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <ShieldCheck className="mr-2 size-4" />
                    Admin area
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 py-6">
        <div className="mx-auto w-full max-w-6xl px-4 text-xs text-muted-foreground sm:px-6">
          SafeSpace complements — never replaces — your local emergency
          services.
        </div>
      </footer>
    </div>
  );
}
