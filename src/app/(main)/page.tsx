
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { getDailyPrompts } from '@/lib/promptsData';
import { useEffect, useState } from 'react';
import { FilePlus2, BookHeart } from 'lucide-react';
import { BloomingFlowerIcon } from '@/components/icons/BloomingFlowerIcon';
import { APP_NAME } from '@/lib/constants'; // Import APP_NAME

export default function HomePage() {
  const { state } = useAppContext();
  const [dailyPrompts, setDailyPrompts] = useState<string[]>([]);
  const [currentQuote, setCurrentQuote] = useState<string>("");

  const inspirationalQuotes = [
    "A gratidão transforma o que temos em suficiente.",
    "Comece cada dia com um coração agradecido.",
    "A felicidade não é ter o que você quer, mas querer o que você tem.",
    "A gratidão é a memória do coração.",
    "Quando focamos na gratidão, a negatividade desaparece.",
    "Cultive o hábito da gratidão por tudo de bom que vem a você.",
  ];

  useEffect(() => {
    setDailyPrompts(getDailyPrompts(state.currentPromptsConfig));
    // Select a random quote daily, or on each load for now
    setCurrentQuote(inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)]);
  }, [state.currentPromptsConfig]);

  const today = new Date();
  const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(today);
  
  const latestEntry = state.journalEntries.length > 0 
    ? state.journalEntries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] 
    : null;

  return (
    <div className="space-y-8">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold text-primary">
                Bem-vindo(a) ao {APP_NAME}!
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                {formattedDate}
              </CardDescription>
            </div>
            <BloomingFlowerIcon className="h-16 w-16 text-primary opacity-70" data-ai-hint="flower icon"/>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg italic text-accent-foreground bg-accent/10 p-4 rounded-md">
            "{currentQuote}"
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <BookHeart className="mr-3 h-7 w-7 text-accent" />
            Sua reflexão de hoje
          </CardTitle>
          <CardDescription>
            Reserve um momento para refletir sobre estas perguntas:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dailyPrompts.map((prompt, index) => (
            <div key={index} className="p-4 bg-secondary/30 rounded-lg text-secondary-foreground">
              <p className="font-medium">{index + 1}. {prompt}</p>
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6">
          <Button asChild size="lg" className="w-full sm:w-auto shadow-md hover:shadow-lg transition-shadow">
            <Link href="/journal/new" className="flex items-center">
              <FilePlus2 className="mr-2 h-5 w-5" />
              Registrar Gratidão
            </Link>
          </Button>
          {latestEntry && (
             <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
               <Link href={`/journal/entry/${latestEntry.id}`}>
                 Ver Última Entrada ({new Date(latestEntry.date).toLocaleDateString('pt-BR')})
               </Link>
             </Button>
          )}
        </CardFooter>
      </Card>

      {/* Placeholder for motivational insights/streaks */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Seu Progresso</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Você praticou gratidão por X dias seguidos!</p>
        </CardContent>
      </Card> */}
    </div>
  );
}
