
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lead } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';

// --- Types ---
interface CalendarEvent {
    id: string;
    leadId: number;
    title: string;
    date: Date;
    type: 'appointment' | 'followup';
    leadName: string;
    phone: string;
    description: string;
    status: string;
}

const CalendarPage: React.FC = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    useEffect(() => {
        if (user) {
            fetchEvents();
        }
    }, [user, currentDate]);

    const fetchEvents = async () => {
        if (!supabase || !user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('user_id', user.id);

            if (data) {
                const loadedEvents: CalendarEvent[] = [];
                
                data.forEach((lead: Lead) => {
                    // 1. Confirmed Appointments
                    if (lead.next_appointment) {
                        loadedEvents.push({
                            id: `appt-${lead.id}`,
                            leadId: lead.id,
                            title: `Viewing: ${lead.name}`,
                            date: new Date(lead.next_appointment),
                            type: 'appointment',
                            leadName: lead.name,
                            phone: lead.phone || '',
                            description: lead.ai_analysis || 'Scheduled viewing.',
                            status: lead.status
                        });
                    }

                    // 2. AI Follow-Up Logic
                    // If lead is active but hasn't been contacted in > 3 days, suggest follow up
                    if (['New', 'Qualified', 'Proposal'].includes(lead.status) && lead.last_contacted_at) {
                        const lastContact = new Date(lead.last_contacted_at);
                        const diffTime = Math.abs(new Date().getTime() - lastContact.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                        
                        // Suggest follow up 3 days after last contact
                        if (diffDays >= 3) {
                            const followUpDate = new Date(lastContact);
                            followUpDate.setDate(lastContact.getDate() + 3);
                            
                            // If date is in past, move to today for visibility
                            const displayDate = followUpDate < new Date() ? new Date() : followUpDate;

                            loadedEvents.push({
                                id: `fu-${lead.id}`,
                                leadId: lead.id,
                                title: `Follow-up: ${lead.name}`,
                                date: displayDate,
                                type: 'followup',
                                leadName: lead.name,
                                phone: lead.phone || '',
                                description: "AI Suggestion: Lead inactive for 3+ days. Check in now.",
                                status: lead.status
                            });
                        }
                    }
                });
                
                setEvents(loadedEvents);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- Date Helpers ---
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const days = getDaysInMonth(currentDate);
    const firstDayIndex = getFirstDayOfMonth(currentDate);
    const blanks = Array.from({ length: firstDayIndex });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    return (
        <div className="h-full overflow-y-auto p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent bg-slate-50">
            <div className="max-w-[1600px] mx-auto space-y-6 h-full flex flex-col">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calendar</h1>
                        <p className="text-slate-500">Manage appointments and AI-suggested follow-ups.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeftIcon className="w-5 h-5" /></Button>
                        <span className="w-40 text-center font-bold text-slate-700">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </span>
                        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRightIcon className="w-5 h-5" /></Button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <Card className="flex-1 border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                    {/* Weekday Header */}
                    <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                {day}
                            </div>
                        ))}
                    </div>
                    
                    {/* Days Grid */}
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                        {/* Empty cells for previous month */}
                        {blanks.map((_, i) => (
                            <div key={`blank-${i}`} className="border-b border-r border-slate-100 bg-slate-50/30"></div>
                        ))}

                        {/* Days */}
                        {days.map((day) => {
                            const dayEvents = events.filter(e => isSameDay(e.date, day));
                            // Sort: Appointments first
                            dayEvents.sort((a, b) => a.type === 'appointment' ? -1 : 1);

                            return (
                                <div key={day.toISOString()} className={cn(
                                    "min-h-[100px] p-2 border-b border-r border-slate-100 transition-colors hover:bg-slate-50 relative group flex flex-col gap-1",
                                    isToday(day) && "bg-blue-50/30"
                                )}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={cn(
                                            "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                                            isToday(day) ? "bg-blue-600 text-white shadow-md" : "text-slate-700"
                                        )}>
                                            {day.getDate()}
                                        </span>
                                        {dayEvents.length > 0 && <span className="text-[10px] text-slate-400 font-medium">{dayEvents.length} items</span>}
                                    </div>

                                    {/* Events List */}
                                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[120px] scrollbar-none">
                                        {dayEvents.map(ev => (
                                            <button 
                                                key={ev.id}
                                                onClick={() => setSelectedEvent(ev)}
                                                className={cn(
                                                    "text-left text-[10px] px-2 py-1.5 rounded-md border truncate font-medium transition-all hover:scale-[1.02] shadow-sm",
                                                    ev.type === 'appointment' 
                                                        ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200" 
                                                        : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                                                )}
                                            >
                                                {ev.type === 'appointment' ? '📅 ' : '🤖 '}
                                                {ev.leadName}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* Legend */}
                <div className="flex gap-6 text-sm text-slate-600 px-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                        <span>Confirmed Appointment</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                        <span>AI Suggestion / Follow-up</span>
                    </div>
                </div>
            </div>

            {/* Event Details Dialog */}
            <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
                <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedEvent?.type === 'appointment' ? '📅 Appointment Details' : '🤖 AI Follow-up Suggestion'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedEvent?.date.toLocaleDateString()} at {selectedEvent?.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Customer</p>
                            <p className="font-semibold text-lg">{selectedEvent?.leadName}</p>
                            <p className="text-sm text-slate-600 font-mono">{selectedEvent?.phone}</p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Context</p>
                            <p className="text-sm text-slate-700 leading-relaxed bg-white border border-slate-200 p-3 rounded-md">
                                {selectedEvent?.description}
                            </p>
                        </div>

                        {selectedEvent?.type === 'followup' && (
                            <div className="flex gap-2">
                                <Button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white" onClick={() => setSelectedEvent(null)}>
                                    Start Chat
                                </Button>
                                <Button variant="outline" className="flex-1" onClick={() => setSelectedEvent(null)}>
                                    Dismiss
                                </Button>
                            </div>
                        )}
                        {selectedEvent?.type === 'appointment' && (
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => setSelectedEvent(null)}>
                                    Reschedule
                                </Button>
                                <Button className="flex-1 bg-green-600 hover:bg-green-500 text-white" onClick={() => setSelectedEvent(null)}>
                                    Mark Complete
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

function ChevronLeftIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    )
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    )
}

export default CalendarPage;
