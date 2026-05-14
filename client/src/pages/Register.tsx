import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { Building2, DollarSign, KeyRound, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { firebaseAuth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getFriendlyRegisterError(error: unknown) {
  if (!(error instanceof FirebaseError)) return "Não foi possível criar a conta. Tente novamente.";

  switch (error.code) {
    case "auth/email-already-in-use":
      return "Este e-mail já está cadastrado.";
    case "auth/invalid-email":
      return "Informe um e-mail válido.";
    case "auth/weak-password":
      return "A senha precisa ter pelo menos 6 caracteres.";
    default:
      return error.message || "Não foi possível criar a conta. Tente novamente.";
  }
}

export default function Register() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!submitting && !loading && user) setLocation("/painel");
  }, [loading, setLocation, submitting, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }

    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await updateProfile(credential.user, { displayName: name.trim() });
      await credential.user.getIdToken(true);
      toast.success("Conta criada com sucesso.");
      setLocation("/painel");
    } catch (error) {
      toast.error(getFriendlyRegisterError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/60 bg-white/50 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden flex-col justify-between bg-gradient-to-br from-slate-900 via-red-800 to-red-700 p-10 text-white lg:flex">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <DollarSign className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm text-red-100">ContaFácil</p>
                <h1 className="text-2xl font-bold">Criar acesso</h1>
              </div>
            </div>
            <div className="space-y-5">
              <h2 className="text-4xl font-bold leading-tight">Cadastre seu usuário e comece sua empresa.</h2>
              <div className="space-y-3 text-red-100">
                <div className="flex items-center gap-3"><Building2 className="h-5 w-5" /><span>Crie a empresa após o primeiro acesso.</span></div>
                <div className="flex items-center gap-3"><UserRound className="h-5 w-5" /><span>Crie o primeiro acesso administrativo para começar.</span></div>
              </div>
            </div>
            <p className="text-sm text-red-100">Tudo pronto para organizar a rotina do seu escritório com mais praticidade.</p>
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
                    <p className="font-semibold">Criar conta</p>
                  </div>
                </div>
                <CardTitle className="text-3xl">Criar conta</CardTitle>
                <CardDescription>Use e-mail e senha para criar o acesso ao sistema.</CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="name" value={name} onChange={event => setName(event.target.value)} className="pl-10" placeholder="Seu nome" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="pl-10" placeholder="seuemail@empresa.com" required />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="pl-10" placeholder="Mín. 6 caracteres" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar</Label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="pl-10" placeholder="Repita a senha" required />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="mt-2 h-12 w-full bg-red-600 text-base hover:bg-red-700" disabled={submitting}>
                    {submitting ? "Criando conta..." : "Criar conta"}
                  </Button>
                </form>

                <div className="mt-6 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <Link href="/" className="transition-colors hover:text-foreground">Voltar</Link>
                  <Link href="/entrar" className="text-red-600 transition-colors hover:text-red-700 hover:underline">Já tenho conta</Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
