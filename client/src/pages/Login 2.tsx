import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { DollarSign, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { firebaseAuth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getFriendlyAuthError(error: unknown) {
  if (!(error instanceof FirebaseError)) return "Não foi possível entrar. Tente novamente.";

  switch (error.code) {
    case "auth/invalid-email":
      return "Informe um e-mail válido.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "E-mail ou senha incorretos.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    default:
      return error.message || "Não foi possível entrar. Tente novamente.";
  }
}

export default function Login() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!loading && user) setLocation("/dashboard");
  }, [loading, setLocation, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await credential.user.getIdToken(true);
      toast.success("Login realizado com sucesso.");
      setLocation("/dashboard");
    } catch (error) {
      toast.error(getFriendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("Informe seu e-mail para receber a recuperação de senha.");
      return;
    }

    setResetting(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, normalizedEmail);
      toast.success("E-mail de recuperação enviado.");
    } catch (error) {
      toast.error(getFriendlyAuthError(error));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/60 bg-white/50 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden flex-col justify-between bg-gradient-to-br from-red-600 to-red-800 p-10 text-white lg:flex">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <DollarSign className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm text-red-100">ContaFácil</p>
                <h1 className="text-2xl font-bold">Gestão de Honorários</h1>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-bold leading-tight">Gestão de honorários simples e elegante.</h2>
              <p className="text-lg text-red-100">Organize clientes, acompanhe recebimentos, gere recibos e tenha sua rotina contábil em um só lugar.</p>
            </div>
            <p className="text-sm text-red-100">Segurança, praticidade e controle para seu escritório contábil.</p>
          </div>

          <div className="p-5 sm:p-8 lg:p-10">
            <Card className="border-white/60 bg-white/70 shadow-none backdrop-blur-md">
              <CardHeader className="space-y-3 px-0 pt-0">
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ContaFácil</p>
                    <p className="font-semibold">Gestão de Honorários</p>
                  </div>
                </div>
                <CardTitle className="text-3xl">Entrar</CardTitle>
                <CardDescription>Entre para acessar o painel do ContaFácil.</CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="pl-10" placeholder="seuemail@empresa.com" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="pl-10" placeholder="••••••••" required />
                    </div>
                  </div>

                  <div className="flex items-center text-sm">
                    <button type="button" onClick={() => void handleResetPassword()} disabled={resetting} className="text-red-600 transition-colors hover:text-red-700 hover:underline disabled:opacity-60">
                      {resetting ? "Enviando..." : "Esqueci minha senha"}
                    </button>
                  </div>

                  <Button type="submit" className="h-12 w-full bg-red-600 text-base hover:bg-red-700" disabled={submitting}>
                    {submitting ? "Entrando..." : "Entrar no sistema"}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  <Link href="/" className="transition-colors hover:text-foreground">Voltar para a página inicial</Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
