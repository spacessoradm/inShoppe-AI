
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lead } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog';

// --- Types ---
interface CalendarEvent {
    id: string;
    leadId: number;
    title: string;
    date: Date;
    type: 'appointment' | 'followup';
    leadName: string;
    phone: string;
    email?: string;
    dealValue?: number;
    aiScore?: number;
    tags?: string[];
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
                    const commonProps = {
                        leadName: lead.name,
                        phone: lead.phone || '',
                        email: lead.email,
                        dealValue: lead.deal_value,
                        aiScore: lead.ai_score,
                        tags: lead.tags,
                        status: lead.status
                    };

                    // 1. Confirmed Appointments
                    if (lead.next_appointment) {
                        loadedEvents.push({
                            id: `appt-${lead.id}`,
                            leadId: lead.id,
                            title: `Viewing: ${lead.name}`,
                            date: new Date(lead.next_appointment),
                            type: 'appointment',
                            description: lead.ai_analysis || 'Scheduled viewing.',
                            ...commonProps
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
                                description: "AI Suggestion: Lead inactive for 3+ days. Check in now.",
                                ...commonProps
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

    const handleCancelAppointment = async () => {
        if (!selectedEvent || !supabase || !user) return;
        
        try {
            // Remove appointment from database
            const { error } = await supabase
                .from('leads')
                .update({ 
                    next_appointment: null,
                    ai_analysis: 'Appointment cancelled manually via calendar.' 
                })
                .eq('id', selectedEvent.leadId);

            if (!error) {
                // Update local state
                setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
                setSelectedEvent(null);
            } else {
                console.error("Failed to cancel appointment:", error);
            }
        } catch (e) {
            console.error("Error cancelling appointment:", e);
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
                                                    "text-left text-[10px] px-2 py-1.5 rounded-md border truncate font-medium transition-all hover:scale-[1.02] shadow-sm flex items-center gap-1",
                                                    ev.type === 'appointment' 
                                                        ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200" 
                                                        : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                                                )}
                                            >
                                                {ev.type === 'appointment' ? <ClockIcon className="h-3 w-3 shrink-0" /> : <BotIcon className="h-3 w-3 shrink-0" />}
                                                <span className="truncate">{ev.leadName}</span>
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

            {/* Event Details Dialog - Enhanced for "Popup with details" */}
            <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
                <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-md shadow-2xl p-0 overflow-hidden gap-0">
                    
                    {/* Header Strip */}
                    <div className={cn(
                        "px-6 py-4 flex flex-col gap-1 border-b",
                        selectedEvent?.type === 'appointment' ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"
                    )}>
                        <div className="flex items-center justify-between">
                            <Badge variant="outline" className={cn(
                                "border-0 font-bold px-2 py-0.5 shadow-sm",
                                selectedEvent?.type === 'appointment' 
                                    ? "bg-amber-100 text-amber-700" 
                                    : "bg-blue-100 text-blue-700"
                            )}>
                                {selectedEvent?.type === 'appointment' ? 'APPOINTMENT' : 'AI TASK'}
                            </Badge>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                {selectedEvent?.status}
                            </span>
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedEvent?.title}</h2>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <CalendarIcon className="h-4 w-4 text-slate-400" />
                            {selectedEvent?.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            <span className="text-slate-300">•</span>
                            <ClockIcon className="h-4 w-4 text-slate-400" />
                            {selectedEvent?.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        {/* Customer Profile Card */}
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Customer Details</h4>
                            <div className="flex items-start gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-600 font-bold text-lg border border-indigo-200 shadow-sm shrink-0">
                                    {selectedEvent?.leadName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <p className="font-semibold text-slate-900 truncate">{selectedEvent?.leadName}</p>
                                        {selectedEvent?.aiScore && selectedEvent.aiScore > 0 && (
                                            <Badge variant="outline" className={cn(
                                                "ml-2 text-[10px]",
                                                selectedEvent.aiScore > 70 ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200"
                                            )}>
                                                Score: {selectedEvent.aiScore}
                                            </Badge>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 gap-1 text-sm text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <PhoneIcon className="h-3.5 w-3.5 text-slate-400" />
                                            <span>{selectedEvent?.phone}</span>
                                        </div>
                                        {selectedEvent?.email && (
                                            <div className="flex items-center gap-2">
                                                <MailIcon className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="truncate">{selectedEvent.email}</span>
                                            </div>
                                        )}
                                    </div>

                                    {selectedEvent?.dealValue && selectedEvent.dealValue > 0 && (
                                        <div className="pt-1">
                                            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                Est. Value: RM {selectedEvent.dealValue.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Context / AI Analysis */}
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Context & Notes</h4>
                            <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-sm text-slate-700 leading-relaxed">
                                {selectedEvent?.description}
                            </div>
                            {selectedEvent?.tags && selectedEvent.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {selectedEvent.tags.map(tag => (
                                        <Badge key={tag} variant="secondary" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200">{tag}</Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                        {selectedEvent?.type === 'followup' && (
                            <>
                                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm" onClick={() => setSelectedEvent(null)}>
                                    Start Chat
                                </Button>
                                <Button variant="outline" className="flex-1 bg-white border-slate-300 text-slate-700 hover:bg-slate-50" onClick={() => setSelectedEvent(null)}>
                                    Dismiss
                                </Button>
                            </>
                        )}
                        {selectedEvent?.type === 'appointment' && (
                            <>
                                <Button 
                                    variant="destructive" 
                                    className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300" 
                                    onClick={handleCancelAppointment}
                                >
                                    Cancel Appt
                                </Button>
                                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm" onClick={() => setSelectedEvent(null)}>
                                    Mark Complete
                                </Button>
                            </>
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

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    )
}

function BotIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
    )
}

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
    )
}

function PhoneIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    )
}

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
    )
}

export default CalendarPage;
