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
  if (!user) return <Redirect to="/entrar" />;
  if (adminOnly && user.role !== "admin") return <Redirect to="/painel" />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  const { loading } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/entrar" component={Login} />
      <Route path="/cadastro" component={Register} />
      <Route path="/painel">{() => <ProtectedPage><Dashboard /></ProtectedPage>}</Route>
      <Route path="/clientes">{() => <ProtectedPage><Clients /></ProtectedPage>}</Route>
      <Route path="/honorarios">{() => <ProtectedPage><Fees /></ProtectedPage>}</Route>
      <Route path="/servicos">{() => <ProtectedPage><Services /></ProtectedPage>}</Route>
      <Route path="/agenda">{() => <ProtectedPage><Agenda /></ProtectedPage>}</Route>
      <Route path="/relatorios">{() => <ProtectedPage adminOnly><Reports /></ProtectedPage>}</Route>
      <Route path="/empresa">{() => <ProtectedPage adminOnly><Company /></ProtectedPage>}</Route>
      <Route path="/usuarios">{() => <ProtectedPage adminOnly><Users /></ProtectedPage>}</Route>

      {/* Compatibilidade com links antigos em inglês */}
      <Route path="/login">{() => <Redirect to="/entrar" />}</Route>
      <Route path="/register">{() => <Redirect to="/cadastro" />}</Route>
      <Route path="/dashboard">{() => <Redirect to="/painel" />}</Route>
      <Route path="/clients">{() => <Redirect to="/clientes" />}</Route>
      <Route path="/fees">{() => <Redirect to="/honorarios" />}</Route>
      <Route path="/services">{() => <Redirect to="/servicos" />}</Route>
      <Route path="/reports">{() => <Redirect to="/relatorios" />}</Route>
      <Route path="/company">{() => <Redirect to="/empresa" />}</Route>
      <Route path="/users">{() => <Redirect to="/usuarios" />}</Route>

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
