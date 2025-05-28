
"use client";

import { useAppContext } from '@/contexts/AppContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart3, TrendingUp, Tags, CalendarCheck2 } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useMemo } from 'react';
import { subDays, format, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';


export default function StatsPage() {
  const { state } = useAppContext();
  const { journalEntries } = state;

  const totalEntries = journalEntries.length;

  const currentStreak = useMemo(() => {
    if (journalEntries.length === 0) return 0;
    const sortedDates = journalEntries
      .map(entry => parseISO(entry.date))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    let currentDate = new Date();
    
    // Check if today has an entry
    if (sortedDates.some(date => isSameDay(date, currentDate))) {
      streak = 1;
    } else {
      // If no entry today, streak is 0, unless the latest entry was yesterday
      if (sortedDates.length > 0 && isSameDay(sortedDates[0], subDays(currentDate,1))) {
         // this case is handled by loop below. If today has no entry, streak is 0 for "current"
         return 0;
      } else {
        return 0; // No entry today or yesterday
      }
    }

    // Check for previous consecutive days
    for (let i = 0; i < sortedDates.length; i++) {
      const entryDate = sortedDates[i];
      const expectedDate = subDays(currentDate, (i === 0 && streak === 1) ? 0 : streak); // If today is counted, next check is today, else yesterday.
      
      if (isSameDay(entryDate, expectedDate)) {
        if (!(i === 0 && streak === 1)) { // don't double count if today was already counted
             streak++;
        }
      } else if (isSameDay(entryDate, subDays(expectedDate,1))) { // Handle if first entry found is yesterday after today
        streak++;
      }
       else if (sortedDates.find(d => isSameDay(d, subDays(currentDate, streak)))) {
        // Check if there's an entry for the next expected day in the streak
        // This ensures we look for a continuous streak from today backwards
        // Loop will continue correctly if this entry is part of streak
      }
      else {
        // if entryDate is not the current day in streak, check if it's from the previous day
        // this is to deal with multiple entries in the same day
        if (!sortedDates.some(d => isSameDay(d, expectedDate))) {
           break; // Streak broken
        }
      }
    }
    return streak;
  }, [journalEntries]);


  const entriesLast7Days = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const count = journalEntries.filter(entry => 
        isSameDay(parseISO(entry.date), date)
      ).length;
      data.push({
        name: format(date, 'dd/MM', { locale: ptBR }),
        shortName: format(date, 'eee', { locale: ptBR }),
        entradas: count,
      });
    }
    return data;
  }, [journalEntries]);

  const commonTags = useMemo(() => {
    const tagCounts: { [key: string]: number } = {};
    journalEntries.forEach(entry => {
      entry.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [journalEntries]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Suas Estatísticas de Gratidão</h1>
        <p className="text-muted-foreground">Acompanhe seu progresso e veja o impacto da gratidão em sua vida.</p>
      </div>

      {totalEntries === 0 ? (
         <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Sem dados para exibir</h3>
              <p className="text-muted-foreground">
                Comece a registrar suas gratidões para ver suas estatísticas aqui!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Entradas</CardTitle>
                <CalendarCheck2 className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{totalEntries}</div>
                <p className="text-xs text-muted-foreground">
                  {totalEntries === 1 ? "reflexão registrada" : "reflexões registradas"}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sequência Atual</CardTitle>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{currentStreak}</div>
                <p className="text-xs text-muted-foreground">
                  {currentStreak === 1 ? "dia de prática consecutiva" : "dias de prática consecutiva"}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tags Mais Usadas</CardTitle>
                <Tags className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                {commonTags.length > 0 ? (
                  <ul className="space-y-1">
                    {commonTags.map(tag => (
                      <li key={tag.name} className="flex justify-between text-sm">
                        <span>{tag.name}</span>
                        <span className="font-semibold">{tag.count}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma tag utilizada ainda.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Entradas nos Últimos 7 Dias</CardTitle>
              <CardDescription>Veja sua atividade recente no diário.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={entriesLast7Days} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="shortName" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)' 
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value, name, props) => [`${value} ${value === 1 ? 'entrada' : 'entradas'} em ${props.payload.name}`, null]}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.875rem', paddingTop: '10px' }} />
                  <Bar dataKey="entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} name="Entradas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
