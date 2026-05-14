import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ConfirmDialogProvider } from "./components/ConfirmDialogProvider";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Fees from "./pages/Fees";
import Reports from "./pages/Reports";
import Company from "./pages/Company";
import Users from "./pages/Users";
import Agenda from "./pages/Agenda";
import Services from "./pages/Services";
import { useAuth } from "./_core/hooks/useAuth";
import DashboardLayout from "./components/DashboardLayout";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";

function ProtectedPage({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <Redirect to="/login" />;
  if (adminOnly && user.role !== "admin") return <Redirect to="/dashboard" />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  const { loading } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard">{() => <ProtectedPage><Dashboard /></ProtectedPage>}</Route>
      <Route path="/clients">{() => <ProtectedPage><Clients /></ProtectedPage>}</Route>
      <Route path="/fees">{() => <ProtectedPage><Fees /></ProtectedPage>}</Route>
      <Route path="/services">{() => <ProtectedPage><Services /></ProtectedPage>}</Route>
      <Route path="/agenda">{() => <ProtectedPage><Agenda /></ProtectedPage>}</Route>
      <Route path="/reports">{() => <ProtectedPage adminOnly><Reports /></ProtectedPage>}</Route>
      <Route path="/company">{() => <ProtectedPage adminOnly><Company /></ProtectedPage>}</Route>
      <Route path="/users">{() => <ProtectedPage adminOnly><Users /></ProtectedPage>}</Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <ConfirmDialogProvider>
            <Toaster />
            <Router />
          </ConfirmDialogProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
