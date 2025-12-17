import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

// Mock data for CRM
const initialLeads = [
  { id: 1, name: 'John Doe', phone: '+1-202-555-0104', email: 'john@example.com', status: 'Qualified', tags: ['VIP', 'Interested'], value: 'RM 299', lastContact: '2h ago' },
  { id: 2, name: 'Jane Smith', phone: '+1-202-555-0176', email: 'jane@tech.com', status: 'New', tags: ['Pricing'], value: 'RM 199', lastContact: '1d ago' },
  { id: 3, name: 'Sam Wilson', phone: '+1-202-555-0182', email: 'sam@agency.com', status: 'Won', tags: ['Enterprise'], value: 'RM 1,500', lastContact: '3d ago' },
  { id: 4, name: 'Alice Brown', phone: '+1-202-555-0199', email: 'alice@cafe.com', status: 'Proposal', tags: ['Cafe'], value: 'RM 899', lastContact: '5h ago' },
  { id: 5, name: 'Michael Lee', phone: '+1-202-555-0111', email: 'mike@dev.com', status: 'Lost', tags: ['Budget'], value: 'RM 0', lastContact: '1w ago' },
];

const statusColors: Record<string, string> = {
    'New': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Qualified': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'Proposal': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Won': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Lost': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const CRMPage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [leads, setLeads] = useState(initialLeads);

    const filteredLeads = leads.filter(lead => 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lead.phone.includes(searchTerm) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase())
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
                    <Button className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20">
                        + Add New Lead
                    </Button>
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
                                        <th className="px-6 py-4">Last Contact</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredLeads.map((lead) => (
                                        <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                                                        {lead.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-white">{lead.name}</div>
                                                        <div className="text-xs text-slate-400">{lead.phone}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge className={cn("border font-medium shadow-none pointer-events-none", statusColors[lead.status] || 'bg-slate-800 text-slate-300')}>
                                                    {lead.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-200">
                                                {lead.value}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {lead.tags.map(tag => (
                                                        <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400">
                                                {lead.lastContact}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-700 hover:text-blue-400">
                                                        <PhoneIcon className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-700 hover:text-emerald-400" onClick={() => window.location.hash = `#/console/chat/${lead.id}`}>
                                                        <MessageCircleIcon className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredLeads.length === 0 && (
                                <div className="p-12 text-center text-slate-500">
                                    No leads found matching "{searchTerm}"
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
             </div>
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