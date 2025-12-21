
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';

// --- CONFIGURATION START ---
// DEMO: Paste your Stripe Publishable Key here to show "Connected" status.
const STRIPE_PUBLISHABLE_KEY = ""; 
// --- CONFIGURATION END ---

const SettingsPage: React.FC = () => {
    const { user, profile, organization } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState(profile?.full_name || 'Merchant Name');
    
    // Check key
    const stripeKey = STRIPE_PUBLISHABLE_KEY || (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY;

    return (
        <div className="h-full overflow-y-auto p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
                    <p className="text-slate-400">Manage your organization, team, and billing.</p>
                </div>

                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 border border-slate-700 mb-6">
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                        <TabsTrigger value="billing">Plan & Billing</TabsTrigger>
                        <TabsTrigger value="integrations">Integrations</TabsTrigger>
                        <TabsTrigger value="danger">Danger Zone</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="profile" className="space-y-4">
                         <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white">
                            <CardHeader>
                                <CardTitle>User Profile</CardTitle>
                                <CardDescription className="text-slate-400">Manage your personal information.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="name" className="text-sm font-medium">Full Name</label>
                                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-950/50 border-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium">Email</label>
                                    <Input id="email" value={user?.email || ''} disabled className="bg-slate-950/50 border-slate-700 opacity-70" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Role</label>
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="border-slate-600 text-slate-300 capitalize">{profile?.role || 'Member'}</Badge>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="border-t border-slate-800 px-6 py-4">
                                <Button>Save Changes</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="billing" className="space-y-4">
                        <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white">
                            <CardHeader>
                                <CardTitle>Organization Subscription</CardTitle>
                                <CardDescription className="text-slate-400">Manage your organization's plan and credits.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-sm text-slate-400 mb-1">Organization Name</p>
                                        <p className="font-semibold text-lg">{organization?.name || 'Loading...'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400 mb-1">Current Plan</p>
                                        {organization?.plan ? (
                                            <Badge className="text-base bg-blue-600 hover:bg-blue-500 px-3 py-1">
                                                {organization.plan}
                                            </Badge>
                                        ) : (
                                            <p className="text-muted-foreground">Loading...</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400 mb-1">Available Credits</p>
                                        <p className="font-mono text-2xl font-bold text-green-400">{organization?.credits || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400 mb-1">Renewal Date</p>
                                        <p className="text-slate-200">
                                            {organization?.current_period_end 
                                                ? new Date(organization.current_period_end).toLocaleDateString() 
                                                : 'N/A (Free Tier)'}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="border-t border-slate-800 pt-4 mt-4">
                                    <h4 className="font-medium mb-4">Plan Options</h4>
                                    <Button variant="outline" onClick={() => navigate('/pricing')} className="border-slate-600 hover:bg-slate-800 hover:text-white w-full sm:w-auto">
                                        Upgrade / Change Plan
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="integrations" className="space-y-4">
                        <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white">
                            <CardHeader>
                                <CardTitle>Stripe Payment Integration</CardTitle>
                                <CardDescription className="text-slate-400">Connect Stripe to process real payments.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Status Indicator */}
                                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
                                    <div>
                                        <h4 className="font-medium text-white mb-1">Frontend Connection</h4>
                                        <p className="text-sm text-slate-400">
                                            Status of Stripe Key (In Code or Env).
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {stripeKey ? (
                                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Connected</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-400 border-slate-600">Not Configured</Badge>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium text-white mb-2">Supabase Edge Function (Backend)</h4>
                                    <p className="text-sm text-slate-400 mb-3">
                                        To enable secure checkout, deploy this function to Supabase. This creates the Stripe Session.
                                    </p>
                                    <div className="bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-800 max-h-[300px]">
                                        <code className="text-xs text-blue-300 font-mono whitespace-pre">
{`// supabase/functions/create-checkout-session/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { price_id, email, user_id } = await req.json()

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: price_id, quantity: 1 }],
      mode: 'subscription',
      success_url: \`\${req.headers.get('origin')}/console/dashboard?session_id={CHECKOUT_SESSION_ID}\`,
      cancel_url: \`\${req.headers.get('origin')}/pricing\`,
      customer_email: email,
      metadata: { user_id: user_id },
    })

    return new Response(JSON.stringify({ sessionId: session.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})`}
                                        </code>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-500">
                                        Deploy command: <code className="bg-slate-800 px-1 rounded">supabase functions deploy create-checkout-session --no-verify-jwt</code>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="danger" className="space-y-4">
                        <Card className="border border-red-900/30 bg-red-950/10 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-red-400">Danger Zone</CardTitle>
                                <CardDescription className="text-red-300/70">These actions are permanent and cannot be undone.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <p className="font-medium text-slate-200">Delete Account & Organization</p>
                                <Button variant="destructive">Delete Account</Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

export default SettingsPage;
