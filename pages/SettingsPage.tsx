
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { PLAN_LIMITS } from '../types';

// --- CONFIGURATION START ---
const getStripeKey = () => {
    try {
        return (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || "";
    } catch {
        return "";
    }
};
// --- CONFIGURATION END ---

const SettingsPage: React.FC = () => {
    const { user, profile, organization } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState(profile?.full_name || 'User');
    const [inviteEmail, setInviteEmail] = useState('');
    
    const stripeKey = getStripeKey();

    const currentPlanLimit = organization ? PLAN_LIMITS[organization.plan] : 1;
    // Mock current users count
    const currentUsers = 1; 

    // Mock Templates for UI
    const [templates, setTemplates] = useState([
        { id: '1', name: 'Standard SPA (Malaysia)', type: 'SPA', file: 'spa_template_v1.docx', default: true },
        { id: '2', name: 'General Invoice', type: 'Invoice', file: 'invoice_gen.docx', default: false }
    ]);

    const handleUploadTemplate = () => {
        // Mock Upload
        const newTemplate = { id: Date.now().toString(), name: 'New Template', type: 'Custom', file: 'uploaded_file.docx', default: false };
        setTemplates([...templates, newTemplate]);
    };

    return (
        <div className="min-h-full bg-slate-50/50">
            <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                
                {/* Page Header */}
                <div className="mb-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{profile?.full_name || 'User'}</h1>
                        <p className="mt-1 text-base text-slate-500">Manage your details and workspace preferences here.</p>
                    </div>
                    {/* Visual flair: Invite CTA */}
                    <div className="hidden sm:flex gap-3">
                        <Button variant="outline" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
                            Refer a friend
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-500 text-white shadow-sm" onClick={() => navigate('/pricing')}>
                            Upgrade Plan
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="profile" className="w-full">
                    {/* Modern Horizontal Navigation */}
                    <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-slate-200 rounded-none mb-8 gap-8 overflow-x-auto scrollbar-none">
                        {['Profile', 'Billing', 'Team', 'Documents', 'Integrations'].map(tab => (
                            <TabsTrigger
                                key={tab}
                                value={tab.toLowerCase()}
                                className="rounded-none border-b-2 border-transparent px-1 py-3 text-sm font-medium text-slate-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent hover:text-slate-800 transition-colors"
                            >
                                {tab}
                            </TabsTrigger>
                        ))}
                        <TabsTrigger
                             value="danger"
                             className="rounded-none border-b-2 border-transparent px-1 py-3 text-sm font-medium text-red-500 data-[state=active]:border-red-600 data-[state=active]:text-red-600 data-[state=active]:bg-transparent hover:text-red-700 ml-auto"
                        >
                            Danger Zone
                        </TabsTrigger>
                    </TabsList>

                    {/* --- PROFILE TAB --- */}
                    <TabsContent value="profile" className="space-y-8 animate-in fade-in-50 duration-300">
                        
                        {/* Security Banner */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-6">
                            <div className="relative w-14 h-14 shrink-0 hidden sm:block">
                                 {/* Circular Progress */}
                                 <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="28" cy="28" r="24" stroke="#f1f5f9" strokeWidth="4" fill="none" />
                                    <circle cx="28" cy="28" r="24" stroke="#3b82f6" strokeWidth="4" fill="none" strokeDasharray="150.7" strokeDashoffset="30" className="text-blue-500 transition-all duration-1000 ease-out" />
                                 </svg>
                                 <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">80%</span>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-base font-semibold text-slate-900">Your account security is 80%</h4>
                                <p className="text-sm text-slate-500 mt-1">Please review your account security settings regularly and update your password.</p>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">Dismiss</Button>
                                <Button className="bg-blue-600 hover:bg-blue-500 text-white">Review security</Button>
                            </div>
                        </div>

                        {/* Basics Section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Basics</h3>
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                                {/* Name Row */}
                                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-50/50 transition-colors">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-900 block">Full Name</label>
                                        <p className="text-sm text-slate-500 mt-1">Set the name used in emails and chats.</p>
                                    </div>
                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                        <Input 
                                            value={name} 
                                            onChange={(e) => setName(e.target.value)}
                                            className="bg-transparent border-slate-200 text-slate-900 w-full sm:w-64 focus:bg-white"
                                        />
                                        <Button variant="outline" size="sm" className="hidden group-hover:inline-flex border-slate-200 bg-white">Save</Button>
                                    </div>
                                </div>

                                {/* Email Row */}
                                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-50/50 transition-colors">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-900 block">Email Address</label>
                                        <p className="text-sm text-slate-500 mt-1">Used for login and notifications.</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-slate-700 font-medium bg-slate-100 px-3 py-1.5 rounded-md">{user?.email}</span>
                                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 pointer-events-none">Verified</Badge>
                                    </div>
                                </div>

                                {/* Role Row */}
                                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-50/50 transition-colors">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-900 block">Role</label>
                                        <p className="text-sm text-slate-500 mt-1">Your permission level in this workspace.</p>
                                    </div>
                                    <Badge variant="outline" className="text-slate-600 border-slate-300 capitalize px-3 py-1 text-sm font-normal">
                                        {profile?.role || 'Member'}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Preferences Section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900">Preferences</h3>
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                                <div className="p-6 flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-900 block">Two-step verification</label>
                                        <p className="text-sm text-slate-500 mt-1">We recommend requiring a verification code for added security.</p>
                                    </div>
                                    <div className="relative inline-block w-11 h-6 transition duration-200 ease-in-out">
                                        {/* Mock Switch */}
                                        <div className="w-11 h-6 bg-slate-200 rounded-full cursor-pointer flex items-center px-1">
                                            <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                    
                    {/* --- BILLING TAB --- */}
                    <TabsContent value="billing" className="space-y-8 animate-in fade-in-50 duration-300">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">{organization?.name}</h3>
                                    <p className="text-sm text-slate-500 mt-1">Subscription managed by {profile?.full_name}</p>
                                </div>
                                <Badge className="bg-blue-600 text-white hover:bg-blue-700 capitalize text-sm px-3 py-1">
                                    {organization?.plan} Plan
                                </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-8 text-center sm:text-left">
                                    <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wide">Credits Available</p>
                                    <p className="text-4xl font-bold text-slate-900 tracking-tight">{organization?.credits || 0}</p>
                                    <p className="text-xs text-slate-400 mt-2">Refreshes next cycle</p>
                                </div>
                                <div className="p-8 text-center sm:text-left">
                                    <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wide">Renewal Date</p>
                                    <p className="text-2xl font-semibold text-slate-900">
                                        {organization?.current_period_end 
                                            ? new Date(organization.current_period_end).toLocaleDateString(undefined, {month: 'long', day: 'numeric'}) 
                                            : 'N/A'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-2">{organization?.plan === 'Free' ? 'Free Tier' : 'Automatic renewal'}</p>
                                </div>
                                <div className="p-8 flex flex-col justify-center gap-3">
                                    <Button onClick={() => navigate('/pricing')} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                                        Upgrade Plan
                                    </Button>
                                    <Button variant="outline" className="w-full border-slate-200 text-slate-600 hover:bg-slate-50">
                                        View Invoices
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* --- TEAM TAB --- */}
                    <TabsContent value="team" className="space-y-8 animate-in fade-in-50 duration-300">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Team Members</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {currentUsers} of {currentPlanLimit} seats used
                                    </p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Input 
                                        placeholder="colleague@company.com" 
                                        className="bg-white border-slate-300 flex-1 sm:w-64"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        disabled={currentUsers >= currentPlanLimit}
                                    />
                                    <Button 
                                        disabled={currentUsers >= currentPlanLimit}
                                        className="bg-blue-600 hover:bg-blue-500 text-white"
                                    >
                                        Invite
                                    </Button>
                                </div>
                            </div>
                            
                            {currentUsers >= currentPlanLimit && (
                                <div className="bg-amber-50 px-6 py-3 border-b border-amber-100 text-sm text-amber-800 flex items-center gap-2">
                                    <span className="font-bold">Limit Reached:</span> You need to upgrade your plan to add more team members.
                                </div>
                            )}

                            <div className="divide-y divide-slate-100">
                                {/* Current User Row */}
                                <div className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{profile?.full_name || 'You'}</p>
                                            <p className="text-xs text-slate-500">{user?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-slate-500 capitalize">{profile?.role}</span>
                                        <Button variant="ghost" size="sm" disabled className="text-slate-400">Owner</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* --- DOCUMENTS TAB --- */}
                    <TabsContent value="documents" className="space-y-8 animate-in fade-in-50 duration-300">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-slate-900">Templates</h3>
                            <Button onClick={handleUploadTemplate} variant="outline" className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50">
                                Upload .DOCX
                            </Button>
                        </div>

                        <div className="grid gap-4">
                            {templates.map(t => (
                                <div key={t.id} className="group flex items-center justify-between p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-blue-300 transition-all hover:shadow-md cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 bg-blue-50 text-blue-600 flex items-center justify-center rounded-lg border border-blue-100 font-bold text-lg">
                                            W
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{t.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200 font-normal">{t.type}</Badge>
                                                <span className="text-xs text-slate-400">• {t.file}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {t.default && <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Default</Badge>}
                                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-900">Edit</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex gap-2 items-start">
                            <span className="text-xl">💡</span>
                            <div>
                                <p className="font-semibold mb-1">Template Variables</p>
                                <p className="text-blue-700/80 mb-2">Use these placeholders in your Word documents to auto-fill data:</p>
                                <div className="flex flex-wrap gap-2">
                                    {['{buyer.name}', '{property.address}', '{transaction.deposit}', '{agent.name}'].map(tag => (
                                        <code key={tag} className="bg-white px-2 py-1 rounded border border-blue-200 text-xs font-mono text-blue-600 select-all">{tag}</code>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* --- INTEGRATIONS TAB --- */}
                    <TabsContent value="integrations" className="space-y-8 animate-in fade-in-50 duration-300">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 flex items-start gap-4">
                                <div className="w-12 h-12 bg-[#635BFF] rounded-lg flex items-center justify-center text-white font-bold text-xl shrink-0">S</div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">Stripe</h3>
                                            <p className="text-sm text-slate-500 mt-1">Payment processing for subscriptions and one-time fees.</p>
                                        </div>
                                        {stripeKey ? (
                                            <Badge className="bg-green-100 text-green-700 border-green-200">Connected</Badge>
                                        ) : (
                                            <Button variant="outline" size="sm" className="border-slate-300">Connect</Button>
                                        )}
                                    </div>
                                    
                                    {!stripeKey && (
                                        <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <p className="text-xs font-mono text-slate-600 mb-2">Setup Required in .env:</p>
                                            <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 block w-fit">VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...</code>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* --- DANGER ZONE --- */}
                    <TabsContent value="danger" className="space-y-8 animate-in fade-in-50 duration-300">
                        <div className="bg-red-50 rounded-xl border border-red-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div>
                                <h3 className="text-lg font-semibold text-red-900">Delete Organization</h3>
                                <p className="text-sm text-red-700 mt-1 max-w-xl">
                                    This action is permanent and cannot be undone. It will delete your organization, all leads, chat history, and remove all team members.
                                </p>
                            </div>
                            <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white shrink-0">
                                Delete Account
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

export default SettingsPage;
