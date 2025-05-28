
"use client";

import { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PlusCircle, BellOff, BellRing, Edit, Trash2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Reminder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const daysOfWeek = [
  { id: 0, label: 'Dom' }, { id: 1, label: 'Seg' }, { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' }, { id: 4, label: 'Qui' }, { id: 5, label: 'Sex' }, { id: 6, label: 'Sáb' }
];

const reminderSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM)"),
  days: z.array(z.number().min(0).max(6)).min(1, "Selecione pelo menos um dia"),
  sound: z.string().min(1, "Selecione um som"),
  enabled: z.boolean(),
});

type ReminderFormData = z.infer<typeof reminderSchema>;

function ReminderForm({ reminder, onSave, onCancel }: { reminder?: Reminder, onSave: (data: Reminder) => void, onCancel: () => void }) {
  const { toast } = useToast();
  const form = useForm<ReminderFormData>({
    resolver: zodResolver(reminderSchema),
    defaultValues: reminder || {
      time: '09:00',
      days: [1, 2, 3, 4, 5], // Default to weekdays
      sound: 'default',
      enabled: true,
    },
  });

  const onSubmit = (data: ReminderFormData) => {
    const newReminderData: Reminder = {
      id: reminder?.id || Date.now().toString(),
      ...data,
    };
    onSave(newReminderData);
    toast({ title: reminder ? "Lembrete Atualizado" : "Lembrete Criado", description: "Seu lembrete foi salvo." });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Horário</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dias da Semana</FormLabel>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {daysOfWeek.map((day) => (
                  <FormField
                    key={day.id}
                    control={form.control}
                    name="days"
                    render={({ field: dayField }) => ( // Renamed field to dayField to avoid conflict
                      <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={dayField.value?.includes(day.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? dayField.onChange([...(dayField.value || []), day.id])
                                : dayField.onChange(
                                    (dayField.value || []).filter(
                                      (value) => value !== day.id
                                    )
                                  );
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{day.label}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sound"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Som do Lembrete</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um som" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="default">Padrão</SelectItem>
                  <SelectItem value="gentle_chime">Sino Suave</SelectItem>
                  <SelectItem value="nature_melody">Melodia da Natureza</SelectItem>
                  <SelectItem value="silent">Silencioso</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Ativar Lembrete</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">Salvar</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}


export default function RemindersPage() {
  const { state, dispatch } = useAppContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined);

  const handleToggleReminder = (id: string, enabled: boolean) => {
    const reminder = state.reminders.find(r => r.id === id);
    if (reminder) {
      dispatch({ type: 'UPDATE_REMINDER', payload: { ...reminder, enabled } });
    }
  };

  const handleSaveReminder = (data: Reminder) => {
    if (editingReminder) {
      dispatch({ type: 'UPDATE_REMINDER', payload: data });
    } else {
      dispatch({ type: 'ADD_REMINDER', payload: data });
    }
    setEditingReminder(undefined);
    setIsFormOpen(false);
  };
  
  const handleDeleteReminder = (id: string) => {
    dispatch({ type: 'DELETE_REMINDER', payload: id });
  };

  const openNewReminderForm = () => {
    setEditingReminder(undefined);
    setIsFormOpen(true);
  };

  const openEditReminderForm = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setIsFormOpen(true);
  };

  const formatDays = (dayIndices: number[]) => {
    if (dayIndices.length === 7) return "Todos os dias";
    if (dayIndices.length === 0) return "Nenhum dia";
    const sortedDays = dayIndices.sort((a,b) => a-b).map(idx => daysOfWeek[idx].label);
    return sortedDays.join(', ');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Lembretes de Gratidão</h1>
          <p className="text-muted-foreground">Configure notificações para te ajudar a manter o hábito.</p>
        </div>
         <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-md hover:shadow-lg transition-shadow" onClick={openNewReminderForm}>
              <PlusCircle className="mr-2 h-5 w-5" />
              Novo Lembrete
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingReminder ? "Editar Lembrete" : "Novo Lembrete"}</DialogTitle>
              <DialogDescription>
                {editingReminder ? "Ajuste os detalhes do seu lembrete." : "Configure um novo lembrete para praticar a gratidão."}
              </DialogDescription>
            </DialogHeader>
            <ReminderForm
              reminder={editingReminder}
              onSave={handleSaveReminder}
              onCancel={() => { setEditingReminder(undefined); setIsFormOpen(false);}}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Alert about native notifications */}
      <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-700/50">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          <CardTitle className="text-yellow-700 dark:text-yellow-300 text-lg">Aviso Importante sobre Notificações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Atualmente, as notificações de lembrete são um recurso conceitual e <strong className="font-semibold">não enviam notificações nativas</strong> no seu dispositivo.
            Esta funcionalidade serve como um planejamento e organização dos seus horários de gratidão dentro do app.
          </p>
        </CardContent>
      </Card>


      {state.reminders.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <BellOff className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum lembrete configurado</h3>
              <p className="text-muted-foreground mb-4">
                Crie um lembrete para não se esquecer de praticar a gratidão.
              </p>
               <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNewReminderForm}>Criar Primeiro Lembrete</Button>
                </DialogTrigger>
                 <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                    <DialogTitle>Novo Lembrete</DialogTitle>
                    <DialogDescription>Configure um novo lembrete para praticar a gratidão.</DialogDescription>
                    </DialogHeader>
                    <ReminderForm
                    onSave={handleSaveReminder}
                    onCancel={() => setIsFormOpen(false)}
                    />
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {state.reminders.map((reminder) => (
            <Card key={reminder.id} className={`transition-opacity ${reminder.enabled ? 'opacity-100' : 'opacity-60'}`}>
              <CardContent className="pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {reminder.enabled ? <BellRing className="h-6 w-6 text-primary" /> : <BellOff className="h-6 w-6 text-muted-foreground" />}
                    <p className="text-2xl font-semibold">{reminder.time}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDays(reminder.days)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Som: {reminder.sound}</p>
                </div>
                <div className="flex items-center gap-4 mt-4 sm:mt-0">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`reminder-toggle-${reminder.id}`}
                      checked={reminder.enabled}
                      onCheckedChange={(checked) => handleToggleReminder(reminder.id, checked)}
                      aria-label={reminder.enabled ? "Desativar lembrete" : "Ativar lembrete"}
                    />
                    <Label htmlFor={`reminder-toggle-${reminder.id}`} className="text-sm">
                      {reminder.enabled ? 'Ativo' : 'Inativo'}
                    </Label>
                  </div>
                   <Button variant="outline" size="icon" onClick={() => openEditReminderForm(reminder)} aria-label="Editar lembrete">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteReminder(reminder.id)} aria-label="Excluir lembrete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

