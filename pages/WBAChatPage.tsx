import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';

const WBAChatPage: React.FC = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [phoneNumberId, setPhoneNumberId] = useState('');
    const [wabaId, setWabaId] = useState('');
    const [token, setToken] = useState('');

    const handleConnect = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Simulate API verification delay
        setTimeout(() => {
            setLoading(false);
            setIsConnected(true);
        }, 1500);
    };

    return (
        <div className="h-full overflow-y-auto p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
             <div className="max-w-[1200px] mx-auto space-y-8">
                 {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">WhatsApp Business API</h1>
                    <p className="text-slate-400">Configure your official Meta WhatsApp Business API connection.</p>
                </div>

                {isConnected ? (
                    // CONNECTED STATE
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Status Card */}
                        <Card className="border border-green-500/30 bg-green-500/5 backdrop-blur-xl text-white">
                             <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                    </span>
                                    API Connected
                                </CardTitle>
                                <CardDescription className="text-green-200/70">Your WhatsApp Business API is active.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-slate-400">Phone Number</p>
                                        <p className="font-medium">+1 555 012 3456</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">Quality Rating</p>
                                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">High (Green)</Badge>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">Messaging Limit</p>
                                        <p className="font-medium">250 / 24 hrs</p>
                                    </div>
                                     <div>
                                        <p className="text-slate-400">Account Status</p>
                                        <p className="font-medium">Verified</p>
                                    </div>
                                </div>
                            </CardContent>
                             <CardFooter>
                                <Button variant="destructive" size="sm" onClick={() => setIsConnected(false)}>Disconnect</Button>
                            </CardFooter>
                        </Card>

                        {/* Webhook Configuration Display */}
                        <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white">
                             <CardHeader className="pb-2">
                                <CardTitle>Webhook Configuration</CardTitle>
                                <CardDescription className="text-slate-400">Use these details in your Meta App Dashboard.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Callback URL</label>
                                    <div className="flex gap-2">
                                        <Input readOnly value="https://api.inshoppe.ai/webhooks/whatsapp" className="bg-slate-950 border-slate-700 font-mono text-xs" />
                                        <Button size="sm" variant="secondary">Copy</Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Verify Token</label>
                                    <div className="flex gap-2">
                                        <Input readOnly value="inshoppe_verification_v1" className="bg-slate-950 border-slate-700 font-mono text-xs" />
                                        <Button size="sm" variant="secondary">Copy</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    // SETUP STATE
                    <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
                        {/* Main Configuration Form */}
                         <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white">
                            <CardHeader>
                                <CardTitle>API Configuration</CardTitle>
                                <CardDescription className="text-slate-400">
                                    Enter your Meta Developer credentials. You can find these in the App Dashboard under WhatsApp &gt; API Setup.
                                </CardDescription>
                            </CardHeader>
                            <form onSubmit={handleConnect}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <label htmlFor="phoneId" className="text-sm font-medium">Phone Number ID</label>
                                        <Input 
                                            id="phoneId" 
                                            placeholder="e.g. 104555555555555" 
                                            required 
                                            value={phoneNumberId}
                                            onChange={(e) => setPhoneNumberId(e.target.value)}
                                            className="bg-slate-950/50 border-slate-700 placeholder:text-slate-600"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="wabaId" className="text-sm font-medium">WhatsApp Business Account ID</label>
                                        <Input 
                                            id="wabaId" 
                                            placeholder="e.g. 109999999999999" 
                                            required
                                            value={wabaId}
                                            onChange={(e) => setWabaId(e.target.value)}
                                            className="bg-slate-950/50 border-slate-700 placeholder:text-slate-600"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="token" className="text-sm font-medium">Permanent Access Token</label>
                                        <Input 
                                            id="token" 
                                            type="password" 
                                            placeholder="EAAG..." 
                                            required 
                                            value={token}
                                            onChange={(e) => setToken(e.target.value)}
                                            className="bg-slate-950/50 border-slate-700 placeholder:text-slate-600 font-mono"
                                        />
                                        <p className="text-xs text-slate-500">
                                            Make sure this is a permanent token from a System User, not a temporary 24h token.
                                        </p>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-between border-t border-slate-800/50 pt-6">
                                    <Button variant="ghost" type="button" className="text-slate-400 hover:text-white">Need Help?</Button>
                                    <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-500 min-w-[120px]">
                                        {loading ? 'Verifying...' : 'Save & Connect'}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>

                        {/* Helper Sidebar */}
                        <div className="space-y-6">
                             <Card className="border border-blue-900/30 bg-blue-900/10 backdrop-blur-xl text-white">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base text-blue-300">Quick Connect</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-slate-300">
                                        Use the embedded signup to automatically create a WABA and get credentials.
                                    </p>
                                    <Button className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold flex items-center gap-2" onClick={(e) => {
                                        e.preventDefault();
                                        setLoading(true);
                                        setTimeout(() => { setIsConnected(true); setLoading(false); }, 2000);
                                    }}>
                                        <FacebookIcon className="h-5 w-5 fill-white" />
                                        Continue with Facebook
                                    </Button>
                                </CardContent>
                            </Card>

                            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
                                <h3 className="font-semibold text-white mb-2 text-sm">Prerequisites</h3>
                                <ul className="space-y-2 text-sm text-slate-400">
                                    <li className="flex gap-2">
                                        <CheckIcon className="h-4 w-4 text-green-500 shrink-0" />
                                        Meta Business Account
                                    </li>
                                    <li className="flex gap-2">
                                        <CheckIcon className="h-4 w-4 text-green-500 shrink-0" />
                                        Verified Phone Number
                                    </li>
                                    <li className="flex gap-2">
                                        <CheckIcon className="h-4 w-4 text-green-500 shrink-0" />
                                        Payment Method Added
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
             </div>
        </div>
    );
};

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
    )
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

export default WBAChatPage;