
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { getDailyPrompts } from "@/lib/promptsData";
import type { GratitudePromptAnswer } from "@/lib/types";
import { useEffect, useState } from "react";
import { CalendarIcon, Save, Mic, Type, Tags } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const journalEntryFormSchema = z.object({
  date: z.date({
    required_error: "A data da entrada é obrigatória.",
  }),
  promptAnswers: z.array(
    z.object({
      answerText: z.string().min(1, "Por favor, preencha este campo.").max(2000, "A resposta não pode exceder 2000 caracteres."),
      // inputMethod: z.enum(['text', 'audio']).optional(), // For future audio input
      // transcribedText: z.string().optional(),
      // answerAudioUrl: z.string().optional(),
    })
  ).min(1, "Pelo menos uma resposta ao prompt é necessária."),
  tags: z.string().optional(),
});

type JournalEntryFormData = z.infer<typeof journalEntryFormSchema>;

export default function NewJournalEntryPage() {
  const { state, dispatch } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();
  const [dailyPrompts, setDailyPrompts] = useState<string[]>([]);

  useEffect(() => {
    setDailyPrompts(getDailyPrompts(state.currentPromptsConfig));
  }, [state.currentPromptsConfig]);
  
  const form = useForm<JournalEntryFormData>({
    resolver: zodResolver(journalEntryFormSchema),
    defaultValues: {
      date: new Date(),
      promptAnswers: dailyPrompts.map(() => ({ answerText: "" })),
      tags: "",
    },
  });

   useEffect(() => {
    // Reset promptAnswers when dailyPrompts change
    form.reset({
      ...form.getValues(), // keep other values like date and tags if they were set
      promptAnswers: dailyPrompts.map(() => ({ answerText: "" })),
    });
  }, [dailyPrompts, form]);


  function onSubmit(data: JournalEntryFormData) {
    const newEntryId = Date.now().toString(); // Simple ID generation
    const newJournalEntry = {
      id: newEntryId,
      date: data.date.toISOString(),
      prompts: data.promptAnswers.map((answer, index): GratitudePromptAnswer => ({
        question: dailyPrompts[index],
        answerText: answer.answerText,
        inputMethod: 'text', // Default to text for now
      })),
      tags: data.tags ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
    };

    dispatch({ type: 'ADD_JOURNAL_ENTRY', payload: newJournalEntry });
    toast({
      title: "Entrada Salva!",
      description: "Sua reflexão de gratidão foi registrada com sucesso.",
    });
    router.push(`/journal/entry/${newEntryId}`);
  }

  if (dailyPrompts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p>Carregando perguntas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary">Nova Entrada de Gratidão</CardTitle>
            <CardDescription>Preencha os campos abaixo para registrar seus pensamentos e sentimentos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-lg font-semibold mb-1">Data da Entrada</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={`w-full sm:w-[240px] pl-3 text-left font-normal ${
                            !field.value && "text-muted-foreground"
                          }`}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Escolha uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => field.onChange(date)}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>Selecione a data para esta entrada.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {dailyPrompts.map((prompt, index) => (
              <FormField
                key={index}
                control={form.control}
                name={`promptAnswers.${index}.answerText`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-semibold text-secondary-foreground/90">
                      {index + 1}. {prompt}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Textarea
                          placeholder="Sua resposta aqui..."
                          className="resize-y min-h-[120px] bg-background/70 focus:bg-background"
                          {...field}
                        />
                        {/* Placeholder for future audio input toggle */}
                        {/* <Button type="button" variant="ghost" size="icon" className="absolute bottom-2 right-2">
                          <Mic className="h-5 w-5" />
                        </Button> */}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-semibold flex items-center">
                    <Tags className="mr-2 h-5 w-5 text-muted-foreground" />
                    Tags (Opcional)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: família, trabalho, natureza (separadas por vírgula)" {...field} />
                  </FormControl>
                  <FormDescription>
                    Adicione tags para organizar suas entradas. Separe com vírgulas.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" size="lg" className="w-full sm:w-auto shadow-md hover:shadow-lg transition-shadow" disabled={form.formState.isSubmitting}>
              <Save className="mr-2 h-5 w-5" />
              {form.formState.isSubmitting ? "Salvando..." : "Salvar Entrada"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

