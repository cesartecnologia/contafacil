import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";

const companySchema = z.object({
  legalName: z.string().min(1, "Razão social é obrigatória"),
  cnpj: z.string().min(14, "CNPJ inválido"),
  address: z.string().optional(),
  phone: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

export default function Company() {
  const { user, refresh: refreshAuth } = useAuth();
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: company, isLoading, refetch: refetchCompany } = trpc.company.getByOwner.useQuery(undefined, {
    enabled: !!user,
  });

  const updateMutation = trpc.company.update.useMutation({
    onSuccess: () => {
      toast.success("Dados da empresa atualizados com sucesso!");
      refetchCompany();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar empresa: " + error.message);
    },
  });

  const createMutation = trpc.company.create.useMutation({
    onSuccess: async () => {
      toast.success("Empresa criada com sucesso!");
      await Promise.all([refetchCompany(), refreshAuth()]);
    },
    onError: (error) => {
      toast.error("Erro ao criar empresa: " + error.message);
    },
  });

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      legalName: company?.legalName || "",
      cnpj: company?.cnpj || "",
      address: company?.address || "",
      phone: company?.phone || "",
    },
  });

  useEffect(() => {
    if (!company) return;
    form.reset({
      legalName: company.legalName || "",
      cnpj: company.cnpj || "",
      address: company.address || "",
      phone: company.phone || "",
    });
    setLogoPreview(company.logoUrl || undefined);
  }, [company, form]);

  const onSubmit = (data: CompanyFormData) => {
    if (company) {
      updateMutation.mutate({
        id: company.id,
        ...data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // A logo é salva no Firestore como Data URL. Mantemos abaixo de 700KB para respeitar o limite de documento do Firestore.
    if (file.size > 700 * 1024) {
      toast.error("Arquivo muito grande. Use uma imagem de até 700KB.");
      return;
    }

    // O PDF usa PNG/JPG com segurança; outros formatos não são aceitos.
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Selecione uma imagem PNG ou JPG.");
      return;
    }

    const reader = new FileReader();

    if (!company) {
      toast.info("Salve os dados da empresa antes de enviar o logotipo.");
      return;
    }

    setIsUploadingLogo(true);
    reader.onload = (event) => {
      const logoUrl = event.target?.result as string;
      setLogoPreview(logoUrl);
      updateMutation.mutate({ id: company.id, logoUrl });
      setIsUploadingLogo(false);
    };
    reader.onerror = () => {
      toast.error("Erro ao ler o arquivo da logo.");
      setIsUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuração da Empresa</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie os dados do seu escritório contábil
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Info */}
        <Card className="backdrop-blur-md bg-white/40 border-white/20 md:col-span-2">
          <CardHeader>
            <CardTitle>Informações da Empresa</CardTitle>
            <CardDescription>
              Atualize os dados do seu escritório contábil
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão Social</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome da sua empresa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="00.000.000/0000-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 3000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, cidade, estado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={updateMutation.isPending || createMutation.isPending}>
                  Salvar Alterações
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Logo Upload */}
        <Card className="backdrop-blur-md bg-white/40 border-white/20">
          <CardHeader>
            <CardTitle>Logotipo</CardTitle>
            <CardDescription>
              Upload do logo da sua empresa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {logoPreview || company?.logoUrl ? (
                <div className="space-y-4">
                  <img
                    src={logoPreview || company?.logoUrl || ""}
                    alt="Logo"
                    className="h-32 mx-auto object-contain"
                  />
                  <p className="text-sm text-muted-foreground">
                    Clique para alterar
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Arraste uma imagem aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG ou JPG até 700KB
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O logotipo será exibido em todos os recibos gerados
            </p>
            {isUploadingLogo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando logo...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
