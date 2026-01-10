
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog';
import { Switch } from '../components/ui/Switch';
import { PLAN_LIMITS } from '../types';
import { supabase } from '../services/supabase';
import { cn } from '../lib/utils';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Imports from AI Chat components (Moved here)
import { KnowledgeBaseTab } from '../components/ai-chat/KnowledgeBaseTab';
import { ConnectionStatusTab } from '../components/ai-chat/ConnectionStatusTab';
import { SystemLogsTab } from '../components/ai-chat/SystemLogsTab';

// --- CONFIGURATION START ---
const getStripeKey = () => {
    try {
        return (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || "";
    } catch {
        return "";
    }
};
// --- CONFIGURATION END ---

const getEnv = (key: string) => {
    let val = '';
    try {
        if ((import.meta as any).env && (import.meta as any).env[key]) {
            val = (import.meta as any).env[key];
        }
    } catch (e) {}
    return val;
};

interface KnowledgeItem {
    id: number;
    content: string;
    similarity?: number;
}

const SettingsPage: React.FC = () => {
    const { user, profile, organization, settings, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [inviteEmail, setInviteEmail] = useState('');
    
    const stripeKey = getStripeKey();

    const currentPlanLimit = organization ? PLAN_LIMITS[organization.plan] : 1;
    const currentUsers = 1; 

    // Templates State
    const [templates, setTemplates] = useState<any[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Edit Modal State
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);

    // Profile Edit State
    const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
    const [profileForm, setProfileForm] = useState({
        full_name: '',
        phone: '',
        bio: '',
        country: '',
        city: ''
    });
    const [savingProfile, setSavingProfile] = useState(false);

    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- KNOWLEDGE BASE STATE ---
    const [knowledgeInput, setKnowledgeInput] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [isEmbedding, setIsEmbedding] = useState(false);
    const [isScraping, setIsScraping] = useState(false);
    const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
    const kbFileInputRef = useRef<HTMLInputElement>(null);

    // --- CONNECTION STATUS STATE ---
    const [webhookStatus, setWebhookStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    
    // --- SYSTEM LOGS STATE ---
    const [logs, setLogs] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Helper: Add Log
    const addLog = (text: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 49)]);
    };

    // Fetch Templates & Knowledge on Mount
    useEffect(() => {
        if (organization && supabase) {
            fetchTemplates();
            fetchKnowledgeBase();
        } else {
            // Demo Data
            setTemplates([
                { id: '1', name: 'Standard SPA (Malaysia)', type: 'SPA', file: 'spa_template_v1.docx', default: true },
                { id: '2', name: 'General Invoice', type: 'Invoice', file: 'invoice_gen.docx', default: false }
            ]);
        }
    }, [organization]);

    // Initialize Profile Form
    useEffect(() => {
        if (profile) {
            setProfileForm({
                full_name: profile.full_name || '',
                phone: profile.phone || '', // Personal contact
                bio: profile.bio || '',
                country: profile.country || '',
                city: profile.city || ''
            });
        }
    }, [profile]);

    const handleProfileUpdate = async () => {
        setSavingProfile(true);
        try {
            if (supabase && user) {
                const { error } = await supabase.from('profiles').update({
                    full_name: profileForm.full_name,
                    phone: profileForm.phone,
                    bio: profileForm.bio,
                    country: profileForm.country,
                    city: profileForm.city
                }).eq('id', user.id);
                
                if (error) throw error;
                await refreshProfile();
                setIsProfileEditOpen(false);
            }
        } catch (e: any) {
            console.error("Profile update failed", e);
            alert("Failed to update profile: " + e.message);
        } finally {
            setSavingProfile(false);
        }
    };

    const fetchTemplates = async () => {
        if (!organization || !supabase) return;
        setLoadingTemplates(true);
        try {
            const { data, error } = await supabase
                .from('document_templates')
                .select('*')
                .eq('organization_id', organization.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            if (data) {
                const formatted = data.map(t => ({
                    id: t.id,
                    name: t.name,
                    type: t.type,
                    file: t.file_path ? t.file_path.split('/').pop() : 'file.docx', 
                    default: t.is_default,
                    file_path: t.file_path
                }));
                setTemplates(formatted);
            }
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoadingTemplates(false);
        }
    };

    // --- KNOWLEDGE BASE FUNCTIONS ---
    const fetchKnowledgeBase = async () => {
        if (!supabase || !organization) return;
        try {
            const { data, error } = await supabase
                .from('knowledge')
                .select('id, content')
                .eq('organization_id', organization.id)
                .order('id', { ascending: false })
                .limit(50);

            if (!error && data) {
                setKnowledgeItems(data);
            }
        } catch (e) {
            console.error("Failed to fetch knowledge base", e);
        }
    };

    const handleKBFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            addLog(`System: Reading ${file.name}...`);
            
            if (file.type === 'application/pdf') {
                try {
                    // @ts-ignore
                    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                         // @ts-ignore
                         pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';
                    }
                    const arrayBuffer = await file.arrayBuffer();
                    const data = new Uint8Array(arrayBuffer);
                    // @ts-ignore
                    const loadingTask = pdfjsLib.getDocument({
                        data,
                        cMapUrl: 'https://esm.sh/pdfjs-dist@5.4.530/cmaps/',
                        cMapPacked: true,
                    });
                    const pdf = await loadingTask.promise;
                    let fullText = '';
                    addLog(`System: PDF loaded. Extracting text from ${pdf.numPages} pages...`);
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        // @ts-ignore
                        const pageText = textContent.items.map((item: any) => item.str).join(' ');
                        fullText += pageText + '\n\n';
                    }
                    
                    if (!fullText.trim()) {
                        addLog("Warning: PDF extracted but no text found.");
                    } else {
                         setKnowledgeInput(fullText);
                         addLog(`System: PDF extraction complete.`);
                    }
                } catch (err: any) {
                    console.error("PDF Parse Error:", err);
                    addLog(`Error: Failed to parse PDF file. ${err.message || err}`);
                }
            } else {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const text = e.target?.result;
                    if (typeof text === 'string') {
                        setKnowledgeInput(text);
                        addLog("System: Text file loaded.");
                    }
                };
                reader.readAsText(file);
            }
        }
    };

    const handleScrape = async () => {
        if (!urlInput || !supabase) return;
        setIsScraping(true);
        addLog(`System: Smart Scraping content from ${urlInput}...`);
        
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Request timed out (120s).")), 120000)
            );
            const jinaUrl = `https://r.jina.ai/${urlInput}`;
            const requestPromise = supabase.functions.invoke('openai-proxy', {
                body: { action: 'scrape', url: jinaUrl }
            });
            const { data, error } = await Promise.race([requestPromise, timeoutPromise]) as any;

            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            
            if (data?.text) {
                setKnowledgeInput(data.text);
                addLog('System: Content scraped successfully.');
            } else {
                addLog('Warning: No content extracted from URL.');
            }
        } catch (e: any) {
            console.error("Scrape Error:", e);
            addLog(`Error: Scraping failed - ${e.message}`);
        } finally {
            setIsScraping(false);
        }
    };

    const addKnowledge = async () => {
        if (!knowledgeInput.trim() || !supabase || !organization) return;
        setIsEmbedding(true);
        try {
            const apiKey = getEnv('VITE_OPENAI_API_KEY') || localStorage.getItem('openai_api_key');
            const { data, error } = await supabase.functions.invoke('openai-proxy', {
                body: { 
                    action: 'embedding', 
                    apiKey: apiKey,
                    model: "text-embedding-3-small",
                    input: knowledgeInput,
                    dimensions: 768
                }
            });

            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            if (data?.data?.[0]?.embedding) {
                 const { error: dbError } = await supabase.from('knowledge').insert({
                    organization_id: organization.id,
                    content: knowledgeInput,
                    embedding: data.data[0].embedding,
                    metadata: { source: 'manual', date: new Date().toISOString() }
                });
                if (dbError) throw dbError;
                
                setKnowledgeInput('');
                addLog('System: Knowledge added successfully.');
                fetchKnowledgeBase();
            }
        } catch (e: any) {
            console.error("Add Knowledge Error:", e);
            addLog(`Error: ${e.message}`);
        } finally {
            setIsEmbedding(false);
        }
    };

    // --- CONNECTION STATUS FUNCTIONS ---
    const checkWebhookReachability = async () => {
        const url = settings?.webhook_url;
        if (!url) return;
        setWebhookStatus('checking');
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: new URLSearchParams({
                    Body: 'Ping from Dashboard',
                    From: 'whatsapp:+0000000000',
                    To: 'whatsapp:+0000000000'
                })
            });
            if (response.ok) {
                setWebhookStatus('success');
                addLog('System: Webhook reachable.');
            } else {
                setWebhookStatus('error');
                addLog(`System: Webhook returned ${response.status}`);
            }
        } catch (e: any) {
            setWebhookStatus('error');
            addLog(`System: Webhook unreachable. ${e.message}`);
        }
    };

    // --- TEMPLATE FUNCTIONS ---
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            if (supabase && organization) {
                const fileExt = file.name.split('.').pop()?.toLowerCase();
                const fileName = `templates/${organization.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                
                const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
                if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

                let docType = 'Custom';
                if (fileExt === 'pdf') docType = 'PDF';
                else if (['xls', 'xlsx'].includes(fileExt || '')) docType = 'Excel';
                else if (['doc', 'docx'].includes(fileExt || '')) docType = 'Word';

                const { data: newDoc, error: dbError } = await supabase
                    .from('document_templates')
                    .insert({
                        organization_id: organization.id,
                        name: file.name,
                        type: docType,
                        file_path: fileName,
                        is_default: false
                    })
                    .select()
                    .single();

                if (dbError) throw dbError;

                if (newDoc) {
                    setTemplates(prev => [{ 
                        id: newDoc.id, name: newDoc.name, type: newDoc.type, file: newDoc.name, default: newDoc.is_default, file_path: newDoc.file_path
                    }, ...prev]);
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 1500));
                setTemplates([...templates, { id: Date.now().toString(), name: file.name, type: 'Custom', file: file.name, default: false }]);
            }
        } catch (error: any) {
            console.error('Upload failed:', error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleEditClick = (template: any) => {
        setEditingTemplate({ ...template });
        setIsEditModalOpen(true);
    };

    const handleSaveTemplate = async () => {
        if (!editingTemplate) return;
        setSavingTemplate(true);
        try {
            if (supabase && organization) {
                const { error } = await supabase
                    .from('document_templates')
                    .update({ name: editingTemplate.name, is_default: editingTemplate.default })
                    .eq('id', editingTemplate.id);
                if (error) throw error;
            }
            setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate : t));
            setIsEditModalOpen(false);
        } catch (error: any) {
            console.error("Failed to update template:", error);
            alert("Failed to update template.");
        } finally {
            setSavingTemplate(false);
        }
    };

    const handleDeleteTemplate = async () => {
        if (!editingTemplate) return;
        if (!confirm("Are you sure?")) return;
        setSavingTemplate(true);
        try {
            if (supabase && organization) {
                await supabase.from('document_templates').delete().eq('id', editingTemplate.id);
                if (editingTemplate.file_path) {
                    await supabase.storage.from('documents').remove([editingTemplate.file_path]);
                }
            }
            setTemplates(prev => prev.filter(t => t.id !== editingTemplate.id));
            setIsEditModalOpen(false);
        } catch (error: any) {
            console.error("Failed to delete:", error);
            alert("Failed to delete template.");
        } finally {
            setSavingTemplate(false);
        }
    };

    // Style helper for tabs
    const tabTriggerClass = "justify-start w-full px-4 py-3 rounded-xl text-slate-500 font-medium hover:text-slate-900 hover:bg-white transition-all text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-bold border-none shadow-none text-left";

    return (
        <div className="min-h-full bg-slate-50/50 p-6 md:p-10">
            <div className="max-w-7xl mx-auto">
                {/* Page Title */}
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">Account Settings</h1>

                <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-8 lg:gap-12" orientation="vertical">
                    
                    {/* --- Sidebar Navigation --- */}
                    <aside className="w-full md:w-60 lg:w-72 shrink-0 flex flex-col gap-1">
                        <TabsList className="flex flex-col h-auto bg-transparent space-y-1 p-0 items-stretch bg-transparent">
                            <TabsTrigger value="profile" className={tabTriggerClass}>My Profile</TabsTrigger>
                            <TabsTrigger value="billing" className={tabTriggerClass}>Billing</TabsTrigger>
                            <TabsTrigger value="team" className={tabTriggerClass}>Team Member</TabsTrigger>
                            <TabsTrigger value="documents" className={tabTriggerClass}>Documents</TabsTrigger>
                            <TabsTrigger value="knowledge" className={tabTriggerClass}>Knowledge Base</TabsTrigger>
                            <TabsTrigger value="connection" className={tabTriggerClass}>Connection Status</TabsTrigger>
                            <TabsTrigger value="logs" className={tabTriggerClass}>System Logs</TabsTrigger>
                        </TabsList>

                        <div className="mt-8 px-4">
                            <button className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors">
                                Delete Account
                            </button>
                        </div>
                    </aside>

                    {/* --- Content Area --- */}
                    <div className="flex-1 min-w-0">
                        
                        {/* PROFILE TAB */}
                        <TabsContent value="profile" className="space-y-6 mt-0 animate-in fade-in-50 duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 mb-6">My Profile</h2>
                                
                                {/* Profile Card */}
                                <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 mb-6 shadow-sm">
                                    <div className="flex flex-col sm:flex-row items-center gap-6">
                                        <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-3xl font-bold border-4 border-indigo-50">
                                            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <div className="text-center sm:text-left">
                                            <h3 className="text-xl font-bold text-slate-900">{profile?.full_name || 'User Name'}</h3>
                                            <p className="text-slate-500 text-sm mb-1">{profile?.role ? profile.role.toUpperCase() : 'MEMBER'}</p>
                                            <p className="text-slate-400 text-xs">
                                                {profile?.city && profile?.country ? `${profile.city}, ${profile.country}` : 'Location not set'}
                                            </p>
                                        </div>
                                        <div className="sm:ml-auto">
                                            <Button variant="outline" size="sm" className="rounded-full border-slate-200" onClick={() => setIsProfileEditOpen(true)}>
                                                Edit <EditIcon className="w-3 h-3 ml-2" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Personal Information */}
                                <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 mb-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold text-slate-900">Personal Information</h3>
                                        <Button variant="outline" size="sm" className="rounded-full border-slate-200" onClick={() => setIsProfileEditOpen(true)}>
                                            Edit <EditIcon className="w-3 h-3 ml-2" />
                                        </Button>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-y-6 gap-x-8">
                                        <div>
                                            <label className="block text-sm text-slate-500 mb-1">Full Name</label>
                                            <div className="font-medium text-slate-900">{profile?.full_name || '-'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-500 mb-1">Email address</label>
                                            <div className="font-medium text-slate-900">{user?.email}</div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-500 mb-1">Phone</label>
                                            <div className="font-medium text-slate-900">{profile?.phone || '-'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-500 mb-1">Bio</label>
                                            <div className="font-medium text-slate-900">{profile?.bio || '-'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Address */}
                                <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold text-slate-900">Address</h3>
                                        <Button variant="outline" size="sm" className="rounded-full border-slate-200" onClick={() => setIsProfileEditOpen(true)}>
                                            Edit <EditIcon className="w-3 h-3 ml-2" />
                                        </Button>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-y-6 gap-x-8">
                                        <div>
                                            <label className="block text-sm text-slate-500 mb-1">Country</label>
                                            <div className="font-medium text-slate-900">{profile?.country || '-'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-500 mb-1">City/State</label>
                                            <div className="font-medium text-slate-900">{profile?.city || '-'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* BILLING TAB */}
                        <TabsContent value="billing" className="mt-0 animate-in fade-in-50 duration-300">
                            <h2 className="text-xl font-bold text-slate-900 mb-6">Billing & Plan</h2>
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">{organization?.name}</h3>
                                        <p className="text-sm text-slate-500 mt-1">Subscription managed by {profile?.full_name}</p>
                                    </div>
                                    <Badge className="bg-blue-600 text-white hover:bg-blue-700 capitalize text-sm px-4 py-1.5 rounded-full">
                                        {organization?.plan} Plan
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                    <div className="p-8">
                                        <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wide">Credits Available</p>
                                        <p className="text-5xl font-bold text-slate-900 tracking-tight">{organization?.credits || 0}</p>
                                    </div>
                                    <div className="p-8 flex flex-col justify-center gap-3 bg-slate-50/20">
                                        <Button onClick={() => navigate('/pricing')} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 rounded-xl">
                                            Upgrade Plan
                                        </Button>
                                        <p className="text-xs text-center text-slate-400">Next billing date: {new Date().toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TEAM TAB */}
                        <TabsContent value="team" className="mt-0 animate-in fade-in-50 duration-300">
                            <h2 className="text-xl font-bold text-slate-900 mb-6">Team Members</h2>
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Manage Team</h3>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {currentUsers} of {currentPlanLimit} seats used
                                        </p>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Input 
                                            placeholder="colleague@company.com" 
                                            className="bg-white border-slate-300 flex-1 sm:w-64 rounded-xl"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            disabled={currentUsers >= currentPlanLimit}
                                        />
                                        <Button 
                                            disabled={currentUsers >= currentPlanLimit}
                                            className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
                                        >
                                            Invite
                                        </Button>
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm border border-blue-200">
                                                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{profile?.full_name || 'You'}</p>
                                                <p className="text-xs text-slate-500">{user?.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-slate-500 capitalize bg-slate-100 px-3 py-1 rounded-full">{profile?.role}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* DOCUMENTS TAB */}
                        <TabsContent value="documents" className="mt-0 animate-in fade-in-50 duration-300">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-900">Document Templates</h2>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange}
                                    className="hidden" 
                                    accept=".docx,.doc,.pdf,.xls,.xlsx"
                                />
                                <Button 
                                    onClick={handleUploadClick} 
                                    className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl"
                                    disabled={uploading}
                                >
                                    {uploading ? 'Uploading...' : "Upload Template"}
                                </Button>
                            </div>

                            {loadingTemplates ? (
                                <div className="py-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">Loading templates...</div>
                            ) : (
                                <div className="grid gap-4">
                                    {templates.map(t => (
                                        <div key={t.id} className="group flex items-center justify-between p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:border-blue-300 transition-all hover:shadow-md cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "h-12 w-12 flex items-center justify-center rounded-2xl font-bold text-lg",
                                                    t.type === 'Word' || t.type === 'SPA' ? "bg-blue-50 text-blue-600" :
                                                    t.type === 'Excel' ? "bg-green-50 text-green-600" :
                                                    t.type === 'PDF' ? "bg-red-50 text-red-600" :
                                                    "bg-slate-50 text-slate-600"
                                                )}>
                                                    {t.type === 'PDF' ? 'P' : t.type === 'Excel' ? 'X' : 'W'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none font-normal">{t.type}</Badge>
                                                        <span className="text-xs text-slate-400">• {t.file}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {t.default && <Badge className="bg-green-100 text-green-700 border-none hover:bg-green-100">Default</Badge>}
                                                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-900" onClick={() => handleEditClick(t)}>Edit</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* KNOWLEDGE TAB */}
                        <TabsContent value="knowledge" className="mt-0 animate-in fade-in-50 duration-300 h-[calc(100vh-150px)]">
                            <KnowledgeBaseTab 
                                urlInput={urlInput}
                                setUrlInput={setUrlInput}
                                handleScrape={handleScrape}
                                isScraping={isScraping}
                                fileInputRef={kbFileInputRef}
                                handleFileUpload={handleKBFileUpload}
                                knowledgeInput={knowledgeInput}
                                setKnowledgeInput={setKnowledgeInput}
                                addKnowledge={addKnowledge}
                                isEmbedding={isEmbedding}
                                knowledgeItems={knowledgeItems}
                            />
                        </TabsContent>

                        {/* CONNECTION TAB */}
                        <TabsContent value="connection" className="mt-0 animate-in fade-in-50 duration-300 h-[calc(100vh-150px)]">
                            <ConnectionStatusTab 
                                webhookUrl={settings?.webhook_url || ''}
                                checkWebhookReachability={checkWebhookReachability}
                                webhookStatus={webhookStatus}
                            />
                        </TabsContent>

                        {/* LOGS TAB */}
                        <TabsContent value="logs" className="mt-0 animate-in fade-in-50 duration-300 h-[600px] rounded-3xl overflow-hidden border border-slate-200">
                            <SystemLogsTab 
                                logs={logs}
                                messagesEndRef={messagesEndRef}
                            />
                        </TabsContent>

                    </div>
                </Tabs>

                {/* EDIT TEMPLATE MODAL */}
                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                    <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[425px] rounded-3xl">
                        <DialogHeader>
                            <DialogTitle>Edit Template</DialogTitle>
                            <DialogDescription>
                                Update template details or remove it.
                            </DialogDescription>
                        </DialogHeader>
                        {editingTemplate && (
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <label htmlFor="t-name" className="text-sm font-medium text-slate-700">Template Name</label>
                                    <Input 
                                        id="t-name" 
                                        value={editingTemplate.name} 
                                        onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                                        className="bg-white border-slate-300 rounded-xl"
                                    />
                                </div>
                                <div className="flex items-center justify-between space-x-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                                    <label htmlFor="t-default" className="text-sm font-medium text-slate-700 flex-1 cursor-pointer">
                                        Set as Default
                                        <p className="text-xs text-slate-500 font-normal">Use this template automatically for its type.</p>
                                    </label>
                                    <Switch 
                                        id="t-default" 
                                        checked={editingTemplate.default}
                                        onCheckedChange={(checked) => setEditingTemplate({...editingTemplate, default: checked})}
                                    />
                                </div>
                            </div>
                        )}
                        <DialogFooter className="flex gap-2 sm:justify-between">
                            <Button variant="destructive" onClick={handleDeleteTemplate} disabled={savingTemplate} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 hover:border-red-300 shadow-none rounded-xl">
                                Delete
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleSaveTemplate} disabled={savingTemplate} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                                    {savingTemplate ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* EDIT PROFILE MODAL */}
                <Dialog open={isProfileEditOpen} onOpenChange={setIsProfileEditOpen}>
                    <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[500px] rounded-3xl">
                        <DialogHeader>
                            <DialogTitle>Edit Profile</DialogTitle>
                            <DialogDescription>
                                Update your personal details.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Full Name</label>
                                <Input 
                                    value={profileForm.full_name} 
                                    onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})}
                                    className="bg-white border-slate-300 rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Country</label>
                                    <Input 
                                        value={profileForm.country} 
                                        onChange={(e) => setProfileForm({...profileForm, country: e.target.value})}
                                        className="bg-white border-slate-300 rounded-xl"
                                        placeholder="e.g. Malaysia"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">City/State</label>
                                    <Input 
                                        value={profileForm.city} 
                                        onChange={(e) => setProfileForm({...profileForm, city: e.target.value})}
                                        className="bg-white border-slate-300 rounded-xl"
                                        placeholder="e.g. Kuala Lumpur"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Personal Phone</label>
                                <Input 
                                    value={profileForm.phone} 
                                    onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                                    className="bg-white border-slate-300 rounded-xl"
                                    placeholder="+60..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Bio / Role</label>
                                <Input 
                                    value={profileForm.bio} 
                                    onChange={(e) => setProfileForm({...profileForm, bio: e.target.value})}
                                    className="bg-white border-slate-300 rounded-xl"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsProfileEditOpen(false)}>Cancel</Button>
                            <Button onClick={handleProfileUpdate} disabled={savingProfile} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                                {savingProfile ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </div>
    );
};

function EditIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
}

export default SettingsPage;
