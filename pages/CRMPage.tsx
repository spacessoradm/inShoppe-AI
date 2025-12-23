
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

const statusColors: Record<string, string> = {
    'New': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Qualified': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'Proposal': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Won': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Lost': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const CRMPage: React.FC = () => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // New Lead Form State
    const [newLeadName, setNewLeadName] = useState('');
    const [newLeadEmail, setNewLeadEmail] = useState('');
    const [newLeadPhone, setNewLeadPhone] = useState('');
    const [newLeadValue, setNewLeadValue] = useState('');
    const [newLeadStatus, setNewLeadStatus] = useState('New');
    const [saving, setSaving] = useState(false);

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
                        console.log("CRM Realtime Status:", status);
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
                // If table doesn't exist yet, we might get an error.
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

    const handleAddLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase || !user) return;
        
        setSaving(true);
        try {
            const { data, error } = await supabase.from('leads').insert({
                user_id: user.id,
                name: newLeadName,
                email: newLeadEmail,
                phone: newLeadPhone,
                status: newLeadStatus,
                deal_value: parseFloat(newLeadValue) || 0,
                tags: ['Manual Entry'],
                created_at: new Date().toISOString()
            }).select().single();

            if (error) throw error;
            
            setIsAddModalOpen(false);
            // Reset form
            setNewLeadName('');
            setNewLeadEmail('');
            setNewLeadPhone('');
            setNewLeadValue('');
            
            // Explicitly refresh to be sure
            fetchLeads();
        } catch (error: any) {
            console.error("Error adding lead:", error.message);
            alert("Failed to add lead. Make sure you have run the latest SQL script.");
        } finally {
            setSaving(false);
        }
    };

    const filteredLeads = leads.filter(lead => 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (lead.phone && lead.phone.includes(searchTerm)) ||
        (lead.email && lead.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="h-full overflow-y-auto p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
             <div className="max-w-[1600px] mx-auto space-y-6">
                 {/* Page Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">CRM & Leads</h1>
                        <p className="text-slate-400">Manage your customer relationships and track deal flow.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={fetchLeads} 
                            variant="outline" 
                            className="border-slate-700 text-slate-300 hover:bg-slate-800"
                            title="Refresh Leads"
                        >
                            <RefreshIcon className={cn("h-4 w-4", loading && "animate-spin")} />
                        </Button>
                        <Button 
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                        >
                            + Add New Lead
                        </Button>
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="flex flex-col sm:flex-row gap-4">
                     <div className="relative flex-1 max-w-md">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input 
                            placeholder="Search leads by name, email or phone..." 
                            className="pl-9 bg-slate-900/40 border-slate-700/50 focus:border-blue-500/50 transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Leads Table Card */}
                <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white shadow-xl overflow-hidden">
                    <CardHeader className="pb-4 border-b border-slate-800/50">
                        <CardTitle className="text-lg font-medium">All Leads</CardTitle>
                        <CardDescription className="text-slate-400">Showing {filteredLeads.length} contacts</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-400 uppercase bg-slate-900/60 font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Deal Value</th>
                                        <th className="px-6 py-4">Tags</th>
                                        <th className="px-6 py-4">Created At</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {loading && leads.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                                <div className="flex justify-center items-center gap-2">
                                                    <div className="h-4 w-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
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
                                            <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors group animate-fadeInUp">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0">
                                                            {lead.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-white">{lead.name}</div>
                                                            <div className="text-xs text-slate-400 flex flex-col sm:flex-row gap-1">
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
                                                    <Badge className={cn("border font-medium shadow-none pointer-events-none", statusColors[lead.status] || 'bg-slate-800 text-slate-300')}>
                                                        {lead.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-200">
                                                    {lead.deal_value ? `RM ${lead.deal_value.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {lead.tags && lead.tags.length > 0 ? lead.tags.map(tag => (
                                                            <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                                                                {tag}
                                                            </span>
                                                        )) : <span className="text-slate-600 text-xs">-</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    {new Date(lead.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-700 hover:text-blue-400">
                                                            <PhoneIcon className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-700 hover:text-emerald-400">
                                                            <MessageCircleIcon className="h-4 w-4" />
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

             {/* Add Lead Modal */}
             <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add New Lead</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Create a new customer profile manually.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddLead} className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="name" className="text-right text-sm font-medium text-slate-300">Name</label>
                            <Input 
                                id="name" 
                                value={newLeadName} 
                                onChange={e => setNewLeadName(e.target.value)} 
                                className="col-span-3 bg-slate-950 border-slate-700" 
                                required 
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="phone" className="text-right text-sm font-medium text-slate-300">Phone</label>
                            <Input 
                                id="phone" 
                                value={newLeadPhone} 
                                onChange={e => setNewLeadPhone(e.target.value)} 
                                className="col-span-3 bg-slate-950 border-slate-700" 
                                placeholder="+1234567890" 
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="email" className="text-right text-sm font-medium text-slate-300">Email</label>
                            <Input 
                                id="email" 
                                type="email"
                                value={newLeadEmail} 
                                onChange={e => setNewLeadEmail(e.target.value)} 
                                className="col-span-3 bg-slate-950 border-slate-700" 
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="value" className="text-right text-sm font-medium text-slate-300">Value (RM)</label>
                            <Input 
                                id="value" 
                                type="number"
                                value={newLeadValue} 
                                onChange={e => setNewLeadValue(e.target.value)} 
                                className="col-span-3 bg-slate-950 border-slate-700" 
                                placeholder="0.00"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="status" className="text-right text-sm font-medium text-slate-300">Status</label>
                            <select 
                                id="status"
                                value={newLeadStatus}
                                onChange={e => setNewLeadStatus(e.target.value)}
                                className="col-span-3 flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <option value="New">New</option>
                                <option value="Qualified">Qualified</option>
                                <option value="Proposal">Proposal</option>
                                <option value="Won">Won</option>
                                <option value="Lost">Lost</option>
                            </select>
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-500" disabled={saving}>
                                {saving ? 'Saving...' : 'Create Lead'}
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

function PhoneIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    )
}

function MessageCircleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
        </svg>
    )
}

export default CRMPage;
