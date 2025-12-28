
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lead } from '../types';
import { analyzeLeadPotential } from '../services/aiEngine';

const statusColors: Record<string, string> = {
    'New': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Qualified': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'Proposal': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Won': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Lost': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

// Helper for AI Score Color
const getScoreColor = (score?: number) => {
    if (score === undefined || score === 0) return "bg-slate-200 text-slate-600";
    if (score >= 80) return "bg-green-100 text-green-700 border-green-200 font-bold";
    if (score >= 50) return "bg-yellow-100 text-yellow-700 border-yellow-200 font-bold";
    return "bg-red-100 text-red-700 border-red-200";
};

const CRMPage: React.FC = () => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    
    // Form State (Shared for Add & Edit)
    const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        value: '',
        status: 'New'
    });
    
    const [saving, setSaving] = useState(false);
    const [analyzingId, setAnalyzingId] = useState<number | null>(null);

    useEffect(() => {
        if (user) {
            fetchLeads();
            
            // Subscribe to Realtime Leads Updates
            if (supabase) {
                const channel = supabase
                    .channel('leads-updates')
                    .on(
                        'postgres_changes',
                        {
                            event: '*', // Listen for INSERT, UPDATE, DELETE
                            schema: 'public',
                            table: 'leads',
                            filter: `user_id=eq.${user.id}`
                        },
                        (payload) => {
                            if (payload.eventType === 'INSERT') {
                                setLeads(prev => {
                                    const newLead = payload.new as Lead;
                                    // Prevent duplicates if Realtime fires after Fetch
                                    if (prev.some(l => l.id === newLead.id)) return prev;
                                    return [newLead, ...prev];
                                });
                            } else if (payload.eventType === 'UPDATE') {
                                setLeads(prev => prev.map(lead => lead.id === payload.new.id ? payload.new as Lead : lead));
                            } else if (payload.eventType === 'DELETE') {
                                setLeads(prev => prev.filter(lead => lead.id !== payload.old.id));
                            }
                        }
                    )
                    .subscribe((status) => {
                        // console.log("CRM Realtime Status:", status);
                    });

                return () => {
                    supabase.removeChannel(channel);
                };
            }
        }
    }, [user]);

    const fetchLeads = async () => {
        if (!supabase || !user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    console.warn("Leads table does not exist. Please run the SQL script.");
                } else {
                    console.error("Error fetching leads:", error);
                }
            } else {
                setLeads(data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEdit = (lead: Lead) => {
        setEditingLeadId(lead.id);
        setFormData({
            name: lead.name,
            email: lead.email || '',
            phone: lead.phone || '',
            value: lead.deal_value ? lead.deal_value.toString() : '',
            status: lead.status
        });
        setIsEditModalOpen(true);
    };

    const handleSaveLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase || !user) return;
        
        setSaving(true);
        try {
            const payload = {
                user_id: user.id,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                status: formData.status,
                deal_value: parseFloat(formData.value) || 0,
                tags: ['Manual Entry'], // Default tag
                // Only update timestamp on creation, or we can update last_contacted on edit
            };

            if (editingLeadId) {
                // UPDATE
                const { error } = await supabase
                    .from('leads')
                    .update(payload)
                    .eq('id', editingLeadId);
                if (error) throw error;
            } else {
                // CREATE
                const { error } = await supabase
                    .from('leads')
                    .insert({ ...payload, created_at: new Date().toISOString() });
                if (error) throw error;
            }
            
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
            
            // Reset form
            setFormData({ name: '', email: '', phone: '', value: '', status: 'New' });
            setEditingLeadId(null);
            
            // Allow realtime to update, or force refresh if needed
            // fetchLeads(); 
        } catch (error: any) {
            console.error("Error saving lead:", error.message);
            alert("Failed to save lead. " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAnalyzeLead = async (lead: Lead) => {
        if (!supabase || !user || !lead.phone) return;
        setAnalyzingId(lead.id);

        try {
            // 1. Fetch conversation history for this lead (by phone)
            const { data: messages, error } = await supabase
                .from('messages')
                .select('text, sender, direction')
                .eq('user_id', user.id)
                .eq('phone', lead.phone)
                .order('created_at', { ascending: true })
                .limit(20);

            if (error) throw error;

            if (!messages || messages.length === 0) {
                alert("No conversation history found for this lead.");
                setAnalyzingId(null);
                return;
            }

            const chatHistory = messages.map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.text
            }));

            // 2. Call AI Engine
            const apiKey = (import.meta as any).env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key');
            const { score, analysis } = await analyzeLeadPotential(chatHistory, apiKey);

            // 3. Update Lead Record
            await supabase.from('leads').update({
                ai_score: score,
                ai_analysis: analysis
            }).eq('id', lead.id);

            // Realtime will update the UI
        } catch (e: any) {
            console.error("Analysis error:", e);
            alert("Analysis failed: " + e.message);
        } finally {
            setAnalyzingId(null);
        }
    };

    const filteredLeads = leads.filter(lead => 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (lead.phone && lead.phone.includes(searchTerm)) ||
        (lead.email && lead.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="h-full overflow-y-auto p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent bg-slate-50">
             <div className="max-w-[1600px] mx-auto space-y-6">
                 {/* Page Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">CRM & Leads</h1>
                        <p className="text-slate-500">Manage your customer relationships and track deal flow.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={fetchLeads} 
                            variant="outline" 
                            className="border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-white"
                            title="Refresh Leads"
                        >
                            <RefreshIcon className={cn("h-4 w-4", loading && "animate-spin")} />
                        </Button>
                        <Button 
                            onClick={() => {
                                setEditingLeadId(null);
                                setFormData({ name: '', email: '', phone: '', value: '', status: 'New' });
                                setIsAddModalOpen(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                        >
                            + Add New Lead
                        </Button>
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="flex flex-col sm:flex-row gap-4">
                     <div className="relative flex-1 max-w-md">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search leads by name, email or phone..." 
                            className="pl-9 bg-white border-slate-200 focus:ring-1 focus:ring-blue-500/50 text-slate-900 transition-colors shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Leads Table Card */}
                <Card className="border border-slate-200 bg-white text-slate-900 shadow-sm overflow-hidden">
                    <CardHeader className="pb-4 border-b border-slate-100">
                        <CardTitle className="text-lg font-medium">All Leads</CardTitle>
                        <CardDescription className="text-slate-500">Showing {filteredLeads.length} contacts</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 font-semibold border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">AI Score</th>
                                        <th className="px-6 py-4">Deal Value</th>
                                        <th className="px-6 py-4">Created At</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading && leads.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                                <div className="flex justify-center items-center gap-2">
                                                    <div className="h-4 w-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div>
                                                    Loading leads...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredLeads.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                {searchTerm ? `No leads found matching "${searchTerm}"` : "No leads yet. New incoming messages will appear here automatically."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLeads.map((lead) => (
                                            <tr key={lead.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 font-bold text-sm border border-blue-200 shrink-0">
                                                            {lead.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-slate-900">{lead.name}</div>
                                                            <div className="text-xs text-slate-500 flex flex-col sm:flex-row gap-1">
                                                                <span>{lead.phone || 'No Phone'}</span>
                                                                {lead.email && (
                                                                    <>
                                                                        <span className="hidden sm:inline">•</span>
                                                                        <span>{lead.email}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge className={cn("border font-medium shadow-none pointer-events-none", statusColors[lead.status] || 'bg-slate-100 text-slate-600')}>
                                                        {lead.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {lead.ai_score ? (
                                                        <div className="flex flex-col gap-1">
                                                            <Badge variant="outline" className={cn(getScoreColor(lead.ai_score), "w-fit")}>
                                                                {lead.ai_score}/100
                                                            </Badge>
                                                            {lead.ai_analysis && <span className="text-[10px] text-slate-400 max-w-[150px] truncate" title={lead.ai_analysis}>{lead.ai_analysis}</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-700">
                                                    {lead.deal_value ? `RM ${lead.deal_value.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 text-xs">
                                                    {new Date(lead.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 text-purple-600"
                                                            title="Run AI Analysis"
                                                            onClick={() => handleAnalyzeLead(lead)}
                                                            disabled={analyzingId === lead.id}
                                                        >
                                                            {analyzingId === lead.id ? (
                                                                <div className="h-3 w-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                                            ) : (
                                                                <SparklesIcon className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 text-slate-500 hover:text-blue-600"
                                                            onClick={() => handleOpenEdit(lead)}
                                                            title="Edit Lead"
                                                        >
                                                            <EditIcon className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
             </div>

             {/* Add/Edit Lead Modal */}
             <Dialog open={isAddModalOpen || isEditModalOpen} onOpenChange={(open) => {
                 if(!open) { setIsAddModalOpen(false); setIsEditModalOpen(false); }
             }}>
                <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[425px] shadow-lg">
                    <DialogHeader>
                        <DialogTitle>{isEditModalOpen ? 'Edit Contact' : 'Add New Lead'}</DialogTitle>
                        <DialogDescription className="text-slate-500">
                            {isEditModalOpen ? 'Update contact details below.' : 'Create a new customer profile manually.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveLead} className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="name" className="text-right text-sm font-medium text-slate-600">Name</label>
                            <Input 
                                id="name" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})} 
                                className="col-span-3 bg-white border-slate-300 focus:ring-blue-500" 
                                required 
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="phone" className="text-right text-sm font-medium text-slate-600">Phone</label>
                            <Input 
                                id="phone" 
                                value={formData.phone} 
                                onChange={e => setFormData({...formData, phone: e.target.value})} 
                                className="col-span-3 bg-white border-slate-300 focus:ring-blue-500" 
                                placeholder="+1234567890" 
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="email" className="text-right text-sm font-medium text-slate-600">Email</label>
                            <Input 
                                id="email" 
                                type="email"
                                value={formData.email} 
                                onChange={e => setFormData({...formData, email: e.target.value})} 
                                className="col-span-3 bg-white border-slate-300 focus:ring-blue-500" 
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="value" className="text-right text-sm font-medium text-slate-600">Value (RM)</label>
                            <Input 
                                id="value" 
                                type="number"
                                value={formData.value} 
                                onChange={e => setFormData({...formData, value: e.target.value})} 
                                className="col-span-3 bg-white border-slate-300 focus:ring-blue-500" 
                                placeholder="0.00"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="status" className="text-right text-sm font-medium text-slate-600">Status</label>
                            <select 
                                id="status"
                                value={formData.status}
                                onChange={e => setFormData({...formData, status: e.target.value})}
                                className="col-span-3 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                                <option value="New">New</option>
                                <option value="Qualified">Qualified</option>
                                <option value="Proposal">Proposal</option>
                                <option value="Won">Won</option>
                                <option value="Lost">Lost</option>
                            </select>
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white" disabled={saving}>
                                {saving ? 'Saving...' : (isEditModalOpen ? 'Update Lead' : 'Create Lead')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
             </Dialog>
        </div>
    );
};

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
        </svg>
    )
}

function EditIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
        </svg>
    )
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
        </svg>
    )
}

export default CRMPage;
