
"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppContext } from '@/contexts/AppContext';
import type { JournalEntry, GratitudePromptAnswer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Edit3, Trash2, Save, Tags, CalendarDays, Mic, Type, Play, Square, Loader2, CalendarIcon as CalendarIconLucide} from 'lucide-react'; // Renamed CalendarIcon to avoid conflict
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { transcribeAudio } from "@/ai/flows/transcribe-audio";
import { AnimatedBloomingFlower } from "@/components/icons/AnimatedBloomingFlower";

const journalEntryEditFormSchema = z.object({
  date: z.date({
    required_error: "A data da entrada é obrigatória.",
  }),
  promptAnswers: z.array(
    z.object({
      answerText: z.string().max(5000, "A resposta não pode exceder 5000 caracteres.").optional(),
    })
  ).min(1, "Pelo menos uma resposta ao prompt é necessária."),
  tags: z.string().optional(),
});

type JournalEntryEditFormData = z.infer<typeof journalEntryEditFormSchema>;

type RecordingStatus = 'idle' | 'recording' | 'recorded' | 'transcribing' | 'error' | 'playing';
type InputMethod = 'text' | 'audio';

export default function JournalEntryPage() {
  const params = useParams();
  const router = useRouter();
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const entryId = typeof params.id === 'string' ? params.id : undefined;

  const [inputMethods, setInputMethods] = useState<InputMethod[]>([]);
  const [recordingStatuses, setRecordingStatuses] = useState<RecordingStatus[]>([]);
  // Store initial audio URIs from the entry, and new/updated ones during edit
  const [audioDataUris, setAudioDataUris] = useState<(string | null)[]>([]); 
  const [transcribedTexts, setTranscribedTexts] = useState<(string | null)[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null); // For playing existing/new audio
  const [activeRecorderIndex, setActiveRecorderIndex] = useState<number | null>(null);

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
        setInputMethods(foundEntry.prompts.map(p => p.inputMethod));
        setAudioDataUris(foundEntry.prompts.map(p => p.answerAudioUrl || null));
        setTranscribedTexts(foundEntry.prompts.map(p => p.transcribedText || null));
        setRecordingStatuses(foundEntry.prompts.map(() => 'idle')); 
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
  
  const updateRecordingStatus = (index: number, status: RecordingStatus) => {
    setRecordingStatuses(prev => prev.map((s, i) => i === index ? status : s));
  };

  const updateInputMethodState = (index: number, method: InputMethod) => {
    setInputMethods(prev => prev.map((m, i) => i === index ? method : m));
     if (method === 'text' && isEditing) { 
        setAudioDataUris(prev => prev.map((uri, i) => i === index ? null : uri));
        // Keep transcribed text if user switches to text. They might want to edit it.
        // setTranscribedTexts(prev => prev.map((text, i) => i === index ? null : text));
        updateRecordingStatus(index, 'idle');
    }
  };

  const startRecording = async (index: number) => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        setActiveRecorderIndex(index);

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            setAudioDataUris(prev => prev.map((uri, i) => i === index ? base64Audio : uri));
            updateRecordingStatus(index, 'transcribing');
            try {
              const { transcription } = await transcribeAudio({ audioDataUri: base64Audio });
              form.setValue(`promptAnswers.${index}.answerText`, transcription);
              setTranscribedTexts(prev => prev.map((text, i) => i === index ? transcription : text));
              updateRecordingStatus(index, 'recorded');
              toast({ title: "Transcrição Concluída" });
            } catch (error) {
              toast({ title: "Erro na Transcrição", variant: "destructive" });
              updateRecordingStatus(index, 'error');
            }
          };
          stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorderRef.current.start();
        updateRecordingStatus(index, 'recording');
      } catch (err) {
        toast({ title: "Erro de Microfone", variant: "destructive" });
        updateRecordingStatus(index, 'error');
      }
    }
  };

  const stopRecording = (index: number) => {
    if (mediaRecorderRef.current && recordingStatuses[index] === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const playAudio = (index: number) => {
    const audioUri = audioDataUris[index];
    if (audioUri && audioPlayerRef.current) {
      audioPlayerRef.current.src = audioUri;
      audioPlayerRef.current.play().catch(e => console.error("Error playing audio:", e));
      updateRecordingStatus(index, 'playing');
      audioPlayerRef.current.onended = () => updateRecordingStatus(index, 'recorded');
    }
  };
  
  const clearAudio = (index: number) => {
    setAudioDataUris(prev => prev.map((uri, i) => (i === index ? null : uri)));
    // setTranscribedTexts(prev => prev.map((text, i) => (i === index ? null : text))); // User might want to keep text
    updateRecordingStatus(index, 'idle');
    if (isEditing && inputMethods[index] === 'audio') updateInputMethodState(index, 'text'); 
  };


  function onSubmit(data: JournalEntryEditFormData) {
    if (!entry) return;

    if (recordingStatuses.some(status => status === 'transcribing')) {
        toast({ title: "Transcrição em Progresso", description: "Aguarde a conclusão.", variant: "default" });
        return;
    }

    for (let i = 0; i < entry.prompts.length; i++) {
        const currentInputMethod = inputMethods[i];
        const currentAnswerText = form.getValues(`promptAnswers.${i}.answerText`);
        const currentAudioUri = audioDataUris[i];

        if (currentInputMethod === 'text' && (!currentAnswerText || currentAnswerText.trim() === "")) {
            form.setError(`promptAnswers.${i}.answerText`, { type: 'manual', message: 'Resposta escrita é obrigatória.' });
            toast({ title: "Campo Obrigatório", description: `A pergunta ${i+1} precisa de uma resposta escrita.`, variant: "destructive"});
            return; 
        }
        if (currentInputMethod === 'audio' && !currentAudioUri && (!currentAnswerText || currentAnswerText.trim() === "")) {
             form.setError(`promptAnswers.${i}.answerText`, { type: 'manual', message: 'Áudio ou transcrição é obrigatório.'});
            toast({ title: "Áudio ou Texto Obrigatório", description: `Para a pergunta ${i+1}, grave um áudio ou forneça/edite uma transcrição.`, variant: "destructive"});
            return;
        }
    }

    const updatedEntry: JournalEntry = {
      ...entry,
      date: data.date.toISOString(),
      prompts: entry.prompts.map((originalPrompt, index) => ({
        ...originalPrompt,
        answerText: data.promptAnswers[index].answerText || transcribedTexts[index] || "",
        inputMethod: inputMethods[index],
        answerAudioUrl: audioDataUris[index] || undefined,
        transcribedText: transcribedTexts[index] || (inputMethods[index] === 'audio' ? data.promptAnswers[index].answerText : undefined),
      })),
      tags: data.tags ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
    };

    dispatch({ type: 'UPDATE_JOURNAL_ENTRY', payload: updatedEntry });
    toast({
      title: (
        <div className="flex items-center">
          <AnimatedBloomingFlower className="mr-2" />
          Entrada Atualizada!
        </div>
      ),
      description: "Sua reflexão de gratidão foi atualizada com sucesso.",
    });
    setEntry(updatedEntry); // Update local entry state to reflect changes immediately
    setIsEditing(false);
  }


  if (!entry) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Carregando entrada...</p>
      </div>
    );
  }
  
  const currentPrompts = entry.prompts; // Use entry.prompts for map length

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/journal')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para o Diário
      </Button>
      <audio ref={audioPlayerRef} className="hidden" />
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
                              <CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" />
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

              {currentPrompts.map((promptAnswer, index) => (
                <div key={promptAnswer.question + index} className="space-y-2"> {/* Ensure unique key */}
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-lg font-semibold text-secondary-foreground/90">
                      {index + 1}. {promptAnswer.question}
                    </Label>
                    {isEditing && (
                      <div className="flex gap-1">
                        <Button 
                          type="button" 
                          variant={inputMethods[index] === 'text' ? "secondary" : "ghost"} 
                          size="icon" 
                          onClick={() => updateInputMethodState(index, 'text')}
                          title="Escrever resposta"
                        >
                          <Type className="h-5 w-5" />
                        </Button>
                        <Button 
                          type="button" 
                          variant={inputMethods[index] === 'audio' ? "secondary" : "ghost"} 
                          size="icon" 
                          onClick={() => updateInputMethodState(index, 'audio')}
                          title="Gravar resposta em áudio"
                        >
                          <Mic className="h-5 w-5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                     <FormField
                        control={form.control}
                        name={`promptAnswers.${index}.answerText`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              {inputMethods[index] === 'text' ? (
                                <Textarea
                                  placeholder="Sua resposta aqui..."
                                  className="resize-y min-h-[100px] bg-background/70 focus:bg-background"
                                  {...field}
                                  value={field.value || ""}
                                />
                               ) : (
                                 <div className="space-y-2 p-3 border rounded-md bg-background/50">
                                  {recordingStatuses[index] === 'idle' && !audioDataUris[index] && (
                                    <Button type="button" onClick={() => startRecording(index)} className="w-full">
                                      <Mic className="mr-2 h-5 w-5" /> Gravar Novo Áudio
                                    </Button>
                                  )}
                                  {recordingStatuses[index] === 'recording' && (
                                    <Button type="button" onClick={() => stopRecording(index)} variant="destructive" className="w-full">
                                      <Square className="mr-2 h-5 w-5" /> Parar Gravação
                                       <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
                                    </Button>
                                  )}
                                  {recordingStatuses[index] === 'transcribing' && (
                                    <Button type="button" disabled className="w-full">
                                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Transcrevendo...
                                    </Button>
                                  )}
                                  {(recordingStatuses[index] === 'recorded' || recordingStatuses[index] === 'playing' || recordingStatuses[index] === 'idle' || recordingStatuses[index] === 'error') && audioDataUris[index] && (
                                    <div className="flex items-center gap-2">
                                      <Button type="button" size="icon" onClick={() => playAudio(index)} disabled={recordingStatuses[index] === 'playing'}>
                                        <Play className="h-5 w-5" />
                                      </Button>
                                      <span className="text-sm text-muted-foreground">Áudio gravado.</span>
                                      <Button type="button" variant="ghost" size="icon" onClick={() => clearAudio(index)} title="Descartar áudio">
                                        <Trash2 className="h-5 w-5 text-destructive" />
                                      </Button>
                                    </div>
                                  )}
                                  {recordingStatuses[index] === 'error' && !audioDataUris[index] && (
                                      <div className="text-destructive text-sm flex items-center gap-2">
                                          Falha ao gravar/transcrever. 
                                          <Button type="button" variant="link" size="sm" onClick={() => startRecording(index)}>Tentar novamente</Button>
                                      </div>
                                  )}
                                  <Textarea
                                    placeholder={audioDataUris[index] ? "A transcrição do áudio aparecerá aqui ou edite o texto existente..." : "A transcrição do áudio aparecerá aqui..."}
                                    className="resize-y min-h-[80px] bg-background/30 focus:bg-background mt-2"
                                    {...field}
                                    readOnly={inputMethods[index] === 'audio' && (recordingStatuses[index] === 'transcribing' || (!!audioDataUris[index] && !field.value)) } 
                                    value={field.value || ""}
                                  />
                                 </div>
                               )}
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                  ) : ( // Visualizing
                    <div className="p-4 bg-secondary/20 rounded-md prose prose-sm max-w-none dark:prose-invert space-y-3">
                      {promptAnswer.answerText && <p>{promptAnswer.answerText}</p>}
                      {promptAnswer.inputMethod === 'audio' && promptAnswer.answerAudioUrl && (
                        <div className="flex items-center gap-2">
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="outline"
                            onClick={() => playAudio(index)}
                            disabled={recordingStatuses[index] === 'playing'}
                          >
                            <Play className="mr-2 h-4 w-4" /> Ouvir Áudio
                          </Button>
                          {recordingStatuses[index] === 'playing' && <span className="text-xs text-muted-foreground">Reproduzindo...</span>}
                        </div>
                      )}
                      {!promptAnswer.answerText && promptAnswer.inputMethod === 'text' && (
                        <p className="italic text-muted-foreground">Nenhuma resposta escrita fornecida.</p>
                      )}
                      {!promptAnswer.answerText && promptAnswer.inputMethod === 'audio' && !promptAnswer.answerAudioUrl && (
                        <p className="italic text-muted-foreground">Nenhum áudio gravado.</p>
                      )}
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
                    if (entry) { // Reset form and local audio/input states to original entry values
                      form.reset({
                        date: new Date(entry.date),
                        promptAnswers: entry.prompts.map(p => ({ answerText: p.answerText || ""})),
                        tags: entry.tags.join(', '),
                      });
                      setInputMethods(entry.prompts.map(p => p.inputMethod));
                      setAudioDataUris(entry.prompts.map(p => p.answerAudioUrl || null));
                      setTranscribedTexts(entry.prompts.map(p => p.transcribedText || null));
                      setRecordingStatuses(entry.prompts.map(() => 'idle'));
                    }
                  }}>
                  Cancelar
                </Button>
                <Button 
                    type="submit" 
                    className="shadow-md hover:shadow-lg transition-shadow" 
                    disabled={form.formState.isSubmitting || recordingStatuses.some(s => s === 'transcribing')}
                >
                  <Save className="mr-2 h-4 w-4" /> 
                  {form.formState.isSubmitting ? "Salvando..." : (recordingStatuses.some(s => s === 'transcribing') ? "Aguarde..." : "Salvar Alterações")}
                </Button>
              </CardFooter>
            )}
          </Card>
        </form>
      </Form>
    </div>
  );
}
