
"use client";

import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, BookOpenText, CalendarDays, Tag } from 'lucide-react';
import type { JournalEntry } from '@/lib/types';

export default function JournalPage() {
  const { state } = useAppContext();
  const sortedEntries = [...state.journalEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getEntrySnippet = (entry: JournalEntry) => {
    if (entry.prompts && entry.prompts.length > 0) {
      const firstAnswer = entry.prompts[0].answerText;
      if (firstAnswer) {
        return firstAnswer.substring(0, 100) + (firstAnswer.length > 100 ? '...' : '');
      }
    }
    return "Nenhum conteúdo de texto para esta entrada.";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Seu Diário de Gratidão</h1>
          <p className="text-muted-foreground">
            Aqui você pode ver todas as suas reflexões e momentos de gratidão.
          </p>
        </div>
        <Button asChild size="lg" className="shadow-md hover:shadow-lg transition-shadow">
          <Link href="/journal/new">
            <PlusCircle className="mr-2 h-5 w-5" />
            Nova Entrada
          </Link>
        </Button>
      </div>

      {sortedEntries.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <BookOpenText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhuma entrada ainda</h3>
              <p className="text-muted-foreground mb-4">
                Que tal registrar sua primeira gratidão hoje?
              </p>
              <Button asChild>
                <Link href="/journal/new">Começar a Escrever</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-20rem)]"> {/* Adjust height as needed */}
          <div className="space-y-6 pr-4">
            {sortedEntries.map((entry) => (
              <Card key={entry.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl hover:text-primary transition-colors">
                        <Link href={`/journal/entry/${entry.id}`}>
                          Reflexão de {new Date(entry.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </Link>
                      </CardTitle>
                      <CardDescription className="flex items-center text-sm mt-1">
                        <CalendarDays className="mr-1.5 h-4 w-4" />
                        {new Date(entry.date).toLocaleDateString('pt-BR', { weekday: 'long' })}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                       <Link href={`/journal/entry/${entry.id}`}>Ver Detalhes</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground italic line-clamp-3">
                    {getEntrySnippet(entry)}
                  </p>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      {entry.tags.map(tag => (
                        <span key={tag} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
