
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppContext } from '@/contexts/AppContext';
import type { JournalEntry, GratitudePromptAnswer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Edit3, Trash2, Save, Tags, CalendarDays, Mic, Type } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";


const journalEntryEditFormSchema = z.object({
  date: z.date({
    required_error: "A data da entrada é obrigatória.",
  }),
  promptAnswers: z.array(
    z.object({
      answerText: z.string().min(1, "Por favor, preencha este campo.").max(2000, "A resposta não pode exceder 2000 caracteres."),
    })
  ).min(1, "Pelo menos uma resposta ao prompt é necessária."),
  tags: z.string().optional(),
});

type JournalEntryEditFormData = z.infer<typeof journalEntryEditFormSchema>;


export default function JournalEntryPage() {
  const params = useParams();
  const router = useRouter();
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const entryId = typeof params.id === 'string' ? params.id : undefined;

  const form = useForm<JournalEntryEditFormData>({
    resolver: zodResolver(journalEntryEditFormSchema),
  });


  useEffect(() => {
    if (entryId) {
      const foundEntry = state.journalEntries.find(e => e.id === entryId);
      if (foundEntry) {
        setEntry(foundEntry);
        form.reset({
          date: new Date(foundEntry.date),
          promptAnswers: foundEntry.prompts.map(p => ({ answerText: p.answerText || ""})),
          tags: foundEntry.tags.join(', '),
        });
      } else {
        toast({ title: "Erro", description: "Entrada não encontrada.", variant: "destructive" });
        router.push('/journal');
      }
    }
  }, [entryId, state.journalEntries, router, toast, form]);

  const handleDelete = () => {
    if (entryId) {
      dispatch({ type: 'DELETE_JOURNAL_ENTRY', payload: entryId });
      toast({ title: "Entrada Excluída", description: "Sua reflexão foi removida." });
      router.push('/journal');
    }
  };
  
  function onSubmit(data: JournalEntryEditFormData) {
    if (!entry) return;

    const updatedEntry: JournalEntry = {
      ...entry,
      date: data.date.toISOString(),
      prompts: entry.prompts.map((originalPrompt, index) => ({
        ...originalPrompt,
        answerText: data.promptAnswers[index].answerText,
      })),
      tags: data.tags ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
    };

    dispatch({ type: 'UPDATE_JOURNAL_ENTRY', payload: updatedEntry });
    toast({
      title: "Entrada Atualizada!",
      description: "Sua reflexão de gratidão foi atualizada com sucesso.",
    });
    setEntry(updatedEntry);
    setIsEditing(false);
  }


  if (!entry) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Carregando entrada...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/journal')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para o Diário
      </Button>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                  <CardTitle className="text-3xl font-bold text-primary">
                    {isEditing ? "Editando Entrada" : "Visualizando Entrada"}
                  </CardTitle>
                  <CardDescription className="flex items-center mt-1">
                    <CalendarDays className="mr-1.5 h-4 w-4 text-muted-foreground" />
                    {isEditing ? "Modifique sua reflexão abaixo." : `Reflexão de ${new Date(entry.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}`}
                  </CardDescription>
                </div>
                {!isEditing && (
                  <div className="flex gap-2 mt-4 sm:mt-0">
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      <Edit3 className="mr-2 h-4 w-4" /> Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir esta entrada do diário? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
               {isEditing ? (
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
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
               ) : (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Data</Label>
                  <p className="text-lg">{new Date(entry.date).toLocaleDateString('pt-BR', { dateStyle: 'full' })}</p>
                </div>
               )}

              {entry.prompts.map((promptAnswer, index) => (
                <div key={index} className="space-y-2">
                  <Label className="text-lg font-semibold text-secondary-foreground/90">
                    {index + 1}. {promptAnswer.question}
                  </Label>
                  {isEditing ? (
                     <FormField
                        control={form.control}
                        name={`promptAnswers.${index}.answerText`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                               <Textarea
                                placeholder="Sua resposta aqui..."
                                className="resize-y min-h-[100px] bg-background/70 focus:bg-background"
                                {...field}
                               />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                  ) : (
                    <div className="p-4 bg-secondary/20 rounded-md prose prose-sm max-w-none dark:prose-invert">
                      {promptAnswer.answerText ? (
                        <p>{promptAnswer.answerText}</p>
                      ) : (
                        <p className="italic text-muted-foreground">Nenhuma resposta fornecida.</p>
                      )}
                       {/* TODO: Display audio player if answerAudioUrl exists */}
                    </div>
                  )}
                </div>
              ))}
              
              <div className="space-y-2">
                <Label className="text-lg font-semibold flex items-center">
                  <Tags className="mr-2 h-5 w-5 text-muted-foreground" /> Tags
                </Label>
                {isEditing ? (
                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Ex: família, trabalho (separadas por vírgula)" {...field} />
                        </FormControl>
                        <FormDescription>
                          Adicione ou edite tags para organizar suas entradas. Separe com vírgulas.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  entry.tags && entry.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {entry.tags.map(tag => (
                        <span key={tag} className="text-sm bg-secondary text-secondary-foreground px-3 py-1 rounded-full shadow-sm">{tag}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="italic text-muted-foreground">Nenhuma tag adicionada.</p>
                  )
                )}
              </div>

            </CardContent>
            {isEditing && (
              <CardFooter className="flex justify-end gap-2">
                 <Button type="button" variant="outline" onClick={() => {
                    setIsEditing(false);
                    // Reset form to original entry values if canceling edit
                    if (entry) {
                      form.reset({
                        date: new Date(entry.date),
                        promptAnswers: entry.prompts.map(p => ({ answerText: p.answerText || ""})),
                        tags: entry.tags.join(', '),
                      });
                    }
                  }}>
                  Cancelar
                </Button>
                <Button type="submit" className="shadow-md hover:shadow-lg transition-shadow" disabled={form.formState.isSubmitting}>
                  <Save className="mr-2 h-4 w-4" /> 
                  {form.formState.isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </form>
      </Form>
    </div>
  );
}
