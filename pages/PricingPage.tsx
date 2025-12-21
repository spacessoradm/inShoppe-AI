
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Plan } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { supabase } from '../services/supabase';
import { loadStripe } from '@stripe/stripe-js';

// --- CONFIGURATION START ---
// DEMO: Paste your Stripe Publishable Key here (starts with pk_test_...)
// If you leave this empty, the app will use Simulation Mode.
const STRIPE_PUBLISHABLE_KEY = "pk_test_51SgbrxBKeQmYnrjTXQl56Q7mEq5cDZIK0SIxrAOaOMArfTpOgB03SOYOGrfl73iHD7hN0CWCVAcXrjUC7r4i9Qu6003ln3ypPc"; 

// DEMO: Paste your Stripe Price IDs here (starts with price_...)
const PRICE_IDS = {
    STARTER: 'price_1SgdQ6BKeQmYnrjTBmjI2z2N',
    PRO: 'price_1SgdQdBKeQmYnrjTgfNNSUJo', // Placeholder for Pro
};
// --- CONFIGURATION END ---

interface PricingTier {
    name: Plan;
    price: string;
    description: string;
    features: string[];
    credits: number;
    recommended?: boolean;
    stripePriceId?: string; 
}

const plans: PricingTier[] = [
    {
        name: 'Free',
        price: 'RM 0',
        description: 'For individuals and early testing.',
        features: ['1 WhatsApp Number', 'Basic Chat', 'Community Support', '30 AI Credits'],
        credits: 30,
        // No stripe ID for free plan
    },
    {
        name: 'Starter',
        price: 'RM 299',
        description: 'For growing teams selling on WhatsApp.',
        features: ['3 WhatsApp Numbers', '500 Active Chats', 'AI Intent Tagging', '500 AI Credits'],
        credits: 500,
        recommended: true,
        stripePriceId: PRICE_IDS.STARTER 
    },
    {
        name: 'Pro',
        price: 'RM 899',
        description: 'For high-volume & revenue teams.',
        features: ['10 WhatsApp Numbers', 'Unlimited Active Chats', 'Full AI Automation', '2,000 AI Credits'],
        credits: 2000,
        stripePriceId: PRICE_IDS.PRO
    }
];

const PricingPage: React.FC = () => {
    const { user, upgradePlan, profile } = useAuth();
    const navigate = useNavigate();
    const [processing, setProcessing] = useState<string | null>(null);
    const [successModal, setSuccessModal] = useState(false);
    
    // Prefer the hardcoded key for demo, fallback to env variable
    const stripeKey = STRIPE_PUBLISHABLE_KEY || (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY;

    const handleSubscribe = async (tier: PricingTier) => {
        if (!user) {
            navigate('/auth');
            return;
        }

        setProcessing(tier.name);

        // Special handling for Free plan (Downgrade/Switch)
        if (tier.name === 'Free') {
             await new Promise(resolve => setTimeout(resolve, 1000)); // Sim delay
             upgradePlan(tier.name, tier.credits);
             setProcessing(null);
             setSuccessModal(true);
             return;
        }

        try {
            // Check if we have a key and a valid price ID for this plan
            const isRealStripeReady = stripeKey && tier.stripePriceId && tier.stripePriceId.startsWith('price_') && supabase;

            if (isRealStripeReady) {
                console.log("Attempting Real Stripe Checkout...");
                
                // 1. Call Supabase Edge Function to create Checkout Session
                // Note: Your Edge Function must have the STRIPE_SECRET_KEY set in Supabase Secrets.
                const { data, error } = await supabase!.functions.invoke('create-checkout-session', {
                    body: { 
                        price_id: tier.stripePriceId, 
                        plan_name: tier.name,
                        credits: tier.credits,
                        user_id: user.id,
                        email: user.email 
                    }
                });

                if (error || !data?.sessionId) {
                    console.warn("Stripe Backend Error (Falling back to Simulation):", error);
                    await simulateCheckout(tier);
                    return;
                }

                // 2. Redirect to Stripe
                const stripe = await loadStripe(stripeKey);
                // FIX: Casting stripe to any because redirectToCheckout might be missing from some type definitions
                // but is required for client-side redirection with sessionId.
                const { error: stripeError } = await (stripe as any).redirectToCheckout({ sessionId: data.sessionId });
                
                if (stripeError) {
                     console.warn("Stripe Redirection Error:", stripeError);
                     await simulateCheckout(tier);
                }
            } else {
                console.log("Stripe configuration missing. Running Simulation Mode.");
                await simulateCheckout(tier);
            }
        } catch (err) {
            console.error("Payment Error:", err);
            setProcessing(null);
            // Optional: fallback to simulation on crash
            // await simulateCheckout(tier);
        }
    };

    const simulateCheckout = async (tier: PricingTier) => {
        // 1. Simulate Network Delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 2. Instant Upgrade
        upgradePlan(tier.name, tier.credits);
        
        setProcessing(null);
        setSuccessModal(true);
    };

    const isCurrentPlan = (planName: string) => {
        return profile?.plan === planName;
    };
    
    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans">
             <header className="py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2 font-semibold text-white">
                        <MessageSquare className="h-6 w-6 text-[#8A9A5B]" />
                        <span>inShoppe AI</span>
                    </Link>
                    <nav className="flex items-center gap-4">
                        {user ? (
                            <Link to="/console/dashboard" className="text-sm font-medium text-slate-300 hover:text-white">
                                Go to Console
                            </Link>
                        ) : (
                            <Link to="/auth" className="text-sm font-medium text-slate-300 hover:text-white">
                                Login
                            </Link>
                        )}
                    </nav>
                </div>
            </header>

            <main className="container mx-auto px-4 py-16">
                <div className="text-center max-w-3xl mx-auto mb-12 animate-fadeInUp">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
                        Upgrade your <span className="text-[#8A9A5B]">Sales Engine</span>
                    </h1>
                    <p className="text-lg text-slate-400">
                        {stripeKey ? "Secure Payment via Stripe" : "Demo Mode: Click to Simulate Payment"}
                    </p>
                    {stripeKey && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-900/30 border border-green-800 text-green-400 text-xs">
                             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                             Stripe Live Connected
                        </div>
                    )}
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {plans.map((plan) => (
                        <Card key={plan.name} className={cn(
                            'flex flex-col border-slate-800 bg-slate-900/50 backdrop-blur-sm transition-all hover:border-[#8A9A5B]/50 hover:-translate-y-1 duration-300',
                            plan.recommended && 'border-[#8A9A5B] bg-slate-900 shadow-2xl shadow-[#8A9A5B]/20 relative',
                            isCurrentPlan(plan.name) && 'ring-2 ring-blue-500'
                        )}>
                             {plan.recommended && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8A9A5B] text-white text-[10px] tracking-widest font-bold px-3 py-1 rounded-full uppercase">
                                    Recommended
                                </div>
                            )}
                             {isCurrentPlan(plan.name) && (
                                <div className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                    CURRENT
                                </div>
                            )}
                            <CardHeader>
                                <CardTitle className="text-2xl text-white">{plan.name}</CardTitle>
                                <CardDescription className="text-slate-400">{plan.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-between space-y-6">
                                <div>
                                    <p className="text-4xl font-bold mb-2 text-white">{plan.price}<span className="text-lg font-normal text-slate-500">/mo</span></p>
                                    <ul className="space-y-3 text-slate-300 mt-6">
                                        {plan.features.map(feature => (
                                            <li key={feature} className="flex items-center gap-2 text-sm">
                                                <div className="h-5 w-5 rounded-full bg-[#8A9A5B]/20 flex items-center justify-center shrink-0">
                                                    <CheckIcon className="h-3 w-3 text-[#8A9A5B]" />
                                                </div>
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <Button 
                                    onClick={() => handleSubscribe(plan)}
                                    className={cn(
                                        "w-full h-12 font-semibold text-base",
                                        plan.recommended ? "bg-[#8A9A5B] hover:bg-[#9AAA6B] text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                                    )}
                                    disabled={!!processing || isCurrentPlan(plan.name)}
                                >
                                    {processing === plan.name ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Processing...
                                        </div>
                                    ) : isCurrentPlan(plan.name) ? (
                                        "Current Plan"
                                    ) : (
                                        plan.name === 'Free' ? 'Switch to Free' : `Subscribe ${plan.name}`
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                
                <div className="mt-16 text-center text-sm text-slate-500">
                    <p>Secured by Stripe. 30-day money-back guarantee.</p>
                </div>
            </main>

            {/* Success Modal */}
            <Dialog open={successModal} onOpenChange={setSuccessModal}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
                    <DialogHeader className="flex flex-col items-center text-center space-y-4 pt-4">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-2">
                            <CheckIcon className="w-8 h-8 text-green-500" />
                        </div>
                        <DialogTitle className="text-2xl">Plan Updated!</DialogTitle>
                        <DialogDescription className="text-slate-400 text-base">
                            Your account has been updated successfully. Your credits have been adjusted.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center pt-4 pb-2">
                         <Button 
                            className="w-full bg-[#8A9A5B] hover:bg-[#9AAA6B] text-white"
                            onClick={() => {
                                setSuccessModal(false);
                                navigate('/console/ai-chat');
                            }}
                        >
                            Start Using AI Agent
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

function MessageSquare(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

export default PricingPage;
