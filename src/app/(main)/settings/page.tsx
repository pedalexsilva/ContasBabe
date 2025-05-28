
"use client";

import { useAppContext } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PromptSetType, AppSettings } from '@/lib/types';
import { Paintbrush, ListChecks, UserCircle, Save } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ThemeToggle } from '@/components/ThemeToggle'; // Assuming ThemeToggle handles its own logic


const settingsFormSchema = z.object({
  activePromptSet: z.enum(['fixed', 'rotating', 'hybrid'], {
    required_error: "Por favor, selecione um tipo de conjunto de perguntas."
  }),
  userName: z.string().max(50, "O nome de usuário não pode exceder 50 caracteres.").optional(),
  // theme is handled by ThemeToggle, not directly in this form for saving
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;


export default function SettingsPage() {
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      activePromptSet: state.settings.activePromptSet,
      userName: state.settings.userName || "",
    },
  });
  
  // Update form if context state changes elsewhere (e.g. initial load)
  React.useEffect(() => {
    form.reset({
      activePromptSet: state.settings.activePromptSet,
      userName: state.settings.userName || "",
    });
  }, [state.settings, form]);


  function onSubmit(data: SettingsFormData) {
    const newSettings: Partial<AppSettings> = {
      activePromptSet: data.activePromptSet,
      userName: data.userName,
    };
    
    dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
    toast({
      title: "Configurações Salvas!",
      description: "Suas preferências foram atualizadas.",
    });
  }

  return (
    <div className="space-y-8">
       <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Configurações</h1>
        <p className="text-muted-foreground">Personalize sua experiência no {state.settings.userName ? `${state.settings.userName}, ` : ""}GratitudeBloom.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center gap-3">
              <Paintbrush className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-xl">Aparência</CardTitle>
                <CardDescription>Escolha o tema visual do aplicativo.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="theme-toggle" className="text-base">Tema</Label>
                <ThemeToggle /> {/* ThemeToggle handles its own state via next-themes */}
              </div>
               <p className="text-sm text-muted-foreground">
                O tema selecionado (Claro, Escuro ou Sistema) é salvo automaticamente.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center gap-3">
              <ListChecks className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-xl">Perguntas do Diário</CardTitle>
                <CardDescription>Defina como as perguntas de gratidão são apresentadas.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
               <FormField
                control={form.control}
                name="activePromptSet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Tipo de Conjunto de Perguntas</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger id="promptSet">
                          <SelectValue placeholder="Selecione um tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">Fixo</SelectItem>
                        <SelectItem value="rotating">Rotativo</SelectItem>
                        <SelectItem value="hybrid">Híbrido</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Fixo: Sempre as mesmas perguntas. Rotativo: Perguntas aleatórias a cada dia. Híbrido: Uma mistura de fixas e rotativas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center gap-3">
              <UserCircle className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-xl">Perfil</CardTitle>
                <CardDescription>Informações básicas sobre você.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="userName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="userName" className="text-base">Seu Nome (Opcional)</FormLabel>
                    <FormControl>
                      <Input id="userName" placeholder="Como podemos te chamar?" {...field} />
                    </FormControl>
                     <FormDescription>
                      Seu nome pode ser usado para personalizar mensagens no aplicativo.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button type="submit" size="lg" className="shadow-md hover:shadow-lg transition-shadow" disabled={form.formState.isSubmitting}>
              <Save className="mr-2 h-5 w-5" />
              {form.formState.isSubmitting ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

