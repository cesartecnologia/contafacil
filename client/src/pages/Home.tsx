import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { BarChart3, DollarSign, Users, FileText, Bell, Lock } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/painel");
    }
  }, [user, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      {/* Navigation */}
      <nav className="border-b border-red-100/50 backdrop-blur-md bg-white/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">ContaFácil</span>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            Entrar
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-6 mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900">
            Gestão de Honorários
            <span className="block text-red-600">Simples e Elegante</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Sistema completo para escritórios contábeis gerenciarem clientes, honorários, gerar recibos em PDF e acompanhar pagamentos em tempo real.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button
              size="lg"
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-lg"
            >
              Começar Agora
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg border-red-200 text-red-600 hover:bg-red-50"
            >
              Saiba Mais
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-20">
          {/* Feature 1 */}
          <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle>Gestão de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Cadastre e gerencie seus clientes com facilidade. Armazene informações de contato, CPF/CNPJ e honorários mensais.
              </CardDescription>
            </CardContent>
          </Card>

          {/* Feature 2 */}
          <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>Honorários Mensais</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Registre honorários, acompanhe vencimentos e marque como pagos. Controle total sobre seus recebimentos.
              </CardDescription>
            </CardContent>
          </Card>

          {/* Feature 3 */}
          <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Recibos em PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Gere recibos profissionais em PDF com dados da empresa, cliente e valor por extenso. Pronto para imprimir.
              </CardDescription>
            </CardContent>
          </Card>

          {/* Feature 4 */}
          <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>Relatórios Financeiros</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Gere relatórios detalhados com filtros por período, cliente e status. Exporte em PDF para análise.
              </CardDescription>
            </CardContent>
          </Card>

          {/* Feature 5 */}
          <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mb-4">
                <Bell className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle>Notificações</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Receba alertas sobre honorários próximos do vencimento e pagamentos em atraso. Nunca perca um prazo.
              </CardDescription>
            </CardContent>
          </Card>

          {/* Feature 6 */}
          <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-indigo-600" />
              </div>
              <CardTitle>Segurança</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Autenticação segura, controle de acesso por perfil e dados protegidos. Sua segurança é nossa prioridade.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-red-600 to-red-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-4xl font-bold">Pronto para simplificar sua gestão?</h2>
          <p className="text-xl text-red-100">
            Comece agora mesmo e tenha controle total sobre seus honorários contábeis.
          </p>
          <Button
            size="lg"
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            className="bg-white text-red-600 hover:bg-red-50 px-8 py-6 text-lg font-semibold"
          >
            Acessar Sistema
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-red-100/50 bg-white/40 backdrop-blur-md py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600">
          <p>&copy; 2026 ContaFácil. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

