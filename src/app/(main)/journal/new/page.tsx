
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { useEffect, useState, useRef } from "react";
import { CalendarIcon, Save, Mic, Type, Tags, Play, Square, Trash2, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { transcribeAudio } from "@/ai/flows/transcribe-audio"; // Import the Genkit flow

const journalEntryFormSchema = z.object({
  date: z.date({
    required_error: "A data da entrada é obrigatória.",
  }),
  promptAnswers: z.array(
    z.object({
      answerText: z.string().max(5000, "A resposta não pode exceder 5000 caracteres.").optional(), // Optional to allow audio-only initially
    })
  ).min(1, "Pelo menos uma resposta ao prompt é necessária."),
  tags: z.string().optional(),
});

type JournalEntryFormData = z.infer<typeof journalEntryFormSchema>;

type RecordingStatus = 'idle' | 'recording' | 'recorded' | 'transcribing' | 'error' | 'playing';
type InputMethod = 'text' | 'audio';

export default function NewJournalEntryPage() {
  const { state, dispatch } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();
  const [dailyPrompts, setDailyPrompts] = useState<string[]>([]);
  
  const [inputMethods, setInputMethods] = useState<InputMethod[]>([]);
  const [recordingStatuses, setRecordingStatuses] = useState<RecordingStatus[]>([]);
  const [audioDataUris, setAudioDataUris] = useState<(string | null)[]>([]);
  const [transcribedTexts, setTranscribedTexts] = useState<(string | null)[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeRecorderIndex, setActiveRecorderIndex] = useState<number | null>(null);


  useEffect(() => {
    const prompts = getDailyPrompts(state.currentPromptsConfig);
    setDailyPrompts(prompts);
    setInputMethods(prompts.map(() => 'text'));
    setRecordingStatuses(prompts.map(() => 'idle'));
    setAudioDataUris(prompts.map(() => null));
    setTranscribedTexts(prompts.map(() => null));
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
    form.reset({
      date: form.getValues('date') || new Date(),
      promptAnswers: dailyPrompts.map((_, index) => ({ 
        answerText: form.getValues(`promptAnswers.${index}.answerText`) || "" 
      })),
      tags: form.getValues('tags') || "",
    });
    setInputMethods(dailyPrompts.map(() => 'text'));
    setRecordingStatuses(dailyPrompts.map(() => 'idle'));
    setAudioDataUris(dailyPrompts.map(() => null));
    setTranscribedTexts(dailyPrompts.map(() => null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyPrompts]);

  const updateRecordingStatus = (index: number, status: RecordingStatus) => {
    setRecordingStatuses(prev => prev.map((s, i) => i === index ? status : s));
  };

  const updateInputMethod = (index: number, method: InputMethod) => {
    setInputMethods(prev => prev.map((m, i) => i === index ? method : m));
    if (method === 'text') {
      setAudioDataUris(prev => prev.map((uri, i) => i === index ? null : uri));
      setTranscribedTexts(prev => prev.map((text, i) => i === index ? null : text));
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
          const audioUrl = URL.createObjectURL(audioBlob); // For potential playback before saving
          
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
              toast({ title: "Transcrição Concluída", description: "Seu áudio foi transcrito." });
            } catch (error) {
              console.error("Transcription error:", error);
              toast({ title: "Erro na Transcrição", description: "Não foi possível transcrever o áudio.", variant: "destructive" });
              updateRecordingStatus(index, 'error');
            }
          };
          stream.getTracks().forEach(track => track.stop()); // Stop microphone access
        };

        mediaRecorderRef.current.start();
        updateRecordingStatus(index, 'recording');
      } catch (err) {
        console.error("Error accessing microphone:", err);
        toast({ title: "Erro de Microfone", description: "Não foi possível acessar o microfone.", variant: "destructive" });
        updateRecordingStatus(index, 'error');
      }
    } else {
      toast({ title: "Navegador incompatível", description: "Seu navegador não suporta gravação de áudio.", variant: "destructive" });
    }
  };

  const stopRecording = (index: number) => {
    if (mediaRecorderRef.current && recordingStatuses[index] === 'recording') {
      mediaRecorderRef.current.stop();
      // Status will be updated in onstop handler
    }
  };
  
  const playAudio = (index: number) => {
    if (audioDataUris[index] && audioRef.current) {
      audioRef.current.src = audioDataUris[index]!;
      audioRef.current.play();
      updateRecordingStatus(index, 'playing');
      audioRef.current.onended = () => updateRecordingStatus(index, 'recorded');
    }
  };

  const clearAudio = (index: number) => {
    setAudioDataUris(prev => prev.map((uri, i) => (i === index ? null : uri)));
    setTranscribedTexts(prev => prev.map((text, i) => (i === index ? null : text)));
    form.setValue(`promptAnswers.${index}.answerText`, "");
    updateRecordingStatus(index, 'idle');
    if (inputMethods[index] === 'audio') updateInputMethod(index, 'text'); // Switch back to text
  };

  function onSubmit(data: JournalEntryFormData) {
     // Check if any prompt is still transcribing
    if (recordingStatuses.some(status => status === 'transcribing')) {
        toast({
        title: "Transcrição em Progresso",
        description: "Por favor, aguarde a conclusão de todas as transcrições antes de salvar.",
        variant: "default",
        });
        return;
    }

    // Validate that if input method is audio, there is an audio URI or transcribed text
    // And if input method is text, there is answerText
    for (let i = 0; i < dailyPrompts.length; i++) {
        const currentInputMethod = inputMethods[i];
        const currentAnswerText = form.getValues(`promptAnswers.${i}.answerText`);
        const currentAudioUri = audioDataUris[i];

        if (currentInputMethod === 'text' && (!currentAnswerText || currentAnswerText.trim() === "")) {
            form.setError(`promptAnswers.${i}.answerText`, {
                type: 'manual',
                message: 'Por favor, preencha este campo ou grave um áudio.'
            });
            toast({ title: "Campo Obrigatório", description: `A pergunta ${i+1} precisa de uma resposta.`, variant: "destructive"});
            return; 
        }
        if (currentInputMethod === 'audio' && !currentAudioUri && (!currentAnswerText || currentAnswerText.trim() === "")) {
             form.setError(`promptAnswers.${i}.answerText`, {
                type: 'manual',
                message: 'Por favor, grave um áudio ou escreva uma resposta.'
            });
            toast({ title: "Áudio Obrigatório", description: `Por favor, grave um áudio para a pergunta ${i+1} ou mude para entrada de texto.`, variant: "destructive"});
            return;
        }
    }


    const newEntryId = Date.now().toString();
    const newJournalEntry = {
      id: newEntryId,
      date: data.date.toISOString(),
      prompts: data.promptAnswers.map((answer, index): GratitudePromptAnswer => ({
        question: dailyPrompts[index],
        answerText: answer.answerText || transcribedTexts[index] || "",
        inputMethod: inputMethods[index],
        answerAudioUrl: audioDataUris[index] || undefined,
        transcribedText: transcribedTexts[index] || undefined,
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
            <audio ref={audioRef} className="hidden" />
            {dailyPrompts.map((prompt, index) => (
              <FormField
                key={index}
                control={form.control}
                name={`promptAnswers.${index}.answerText`}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center mb-1">
                      <FormLabel className="text-lg font-semibold text-secondary-foreground/90">
                        {index + 1}. {prompt}
                      </FormLabel>
                      <div className="flex gap-1">
                        <Button 
                          type="button" 
                          variant={inputMethods[index] === 'text' ? "secondary" : "ghost"} 
                          size="icon" 
                          onClick={() => updateInputMethod(index, 'text')}
                          title="Escrever resposta"
                        >
                          <Type className="h-5 w-5" />
                        </Button>
                        <Button 
                          type="button" 
                          variant={inputMethods[index] === 'audio' ? "secondary" : "ghost"} 
                          size="icon" 
                          onClick={() => updateInputMethod(index, 'audio')}
                          title="Gravar resposta em áudio"
                        >
                          <Mic className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    <FormControl>
                      {inputMethods[index] === 'text' ? (
                        <Textarea
                          placeholder="Sua resposta aqui..."
                          className="resize-y min-h-[120px] bg-background/70 focus:bg-background"
                          {...field}
                          value={field.value || ""}
                        />
                      ) : (
                        <div className="space-y-2 p-3 border rounded-md bg-background/50">
                          {recordingStatuses[index] === 'idle' && (
                            <Button type="button" onClick={() => startRecording(index)} className="w-full">
                              <Mic className="mr-2 h-5 w-5" /> Iniciar Gravação
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
                          {(recordingStatuses[index] === 'recorded' || recordingStatuses[index] === 'playing' || recordingStatuses[index] === 'error') && audioDataUris[index] && (
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
                            placeholder="A transcrição do seu áudio aparecerá aqui..."
                            className="resize-y min-h-[80px] bg-background/30 focus:bg-background mt-2"
                            {...field}
                            readOnly={recordingStatuses[index] === 'transcribing' || !!audioDataUris[index]} // Readonly while transcribing or if audio exists
                            value={field.value || ""}
                          />
                        </div>
                      )}
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
            <Button 
              type="submit" 
              size="lg" 
              className="w-full sm:w-auto shadow-md hover:shadow-lg transition-shadow" 
              disabled={form.formState.isSubmitting || recordingStatuses.some(s => s === 'transcribing')}
            >
              <Save className="mr-2 h-5 w-5" />
              {form.formState.isSubmitting ? "Salvando..." : (recordingStatuses.some(s => s === 'transcribing') ? "Aguarde transcrição..." : "Salvar Entrada")}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
