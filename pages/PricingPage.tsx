import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Plan } from '../types';

const plans = [
    {
        name: 'Starter' as Plan,
        price: 'RM199',
        description: 'Perfect for getting started.',
        features: ['1 WhatsApp Number', '100 Active Chats', 'Basic Auto-Reply'],
        cta: 'Start Free Trial'
    },
    {
        name: 'Growth' as Plan,
        price: 'RM399',
        description: 'For growing businesses.',
        features: ['3 WhatsApp Numbers', '500 Active Chats', 'AI Intent Tagging'],
        cta: 'Choose Growth',
        recommended: true
    },
    {
        name: 'Pro' as Plan,
        price: 'RM999',
        description: 'For large-scale operations.',
        features: ['10 WhatsApp Numbers', 'Unlimited Active Chats', 'Full AI Automation'],
        cta: 'Choose Pro'
    }
];

const PricingPage: React.FC = () => {
    const { user, selectPlan } = useAuth();
    const navigate = useNavigate();

    const handleSelectPlan = (plan: Plan) => {
        if (user) {
            selectPlan(plan);
            navigate('/console/settings');
        } else {
            // You might want to save the selected plan and redirect after login
            navigate('/auth');
        }
    };
    
    return (
        <div className="min-h-screen bg-background">
             <header className="py-4 border-b">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2 font-semibold">
                        <MessageSquare className="h-6 w-6 text-primary" />
                        <span>inShoppe AI</span>
                    </Link>
                    <nav className="flex items-center gap-4">
                        <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-primary">
                            Login
                        </Link>
                        <Button onClick={() => navigate('/auth')}>Get Started</Button>
                    </nav>
                </div>
            </header>
            <main className="container mx-auto px-4 py-16">
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Choose the plan that grows with your business</h1>
                    <p className="text-lg text-muted-foreground">Monthly billing only for now. Cancel anytime.</p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {plans.map((plan) => (
                        <Card key={plan.name} className={cn('flex flex-col hover:border-primary transition-all', plan.recommended && 'border-primary border-2 relative')}>
                             {plan.recommended && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                                    RECOMMENDED
                                </div>
                            )}
                            <CardHeader>
                                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                <CardDescription>{plan.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-between space-y-6">
                                <div>
                                    <p className="text-4xl font-bold mb-2">{plan.price}<span className="text-lg font-normal text-muted-foreground">/month</span></p>
                                    <ul className="space-y-3 text-muted-foreground">
                                        {plan.features.map(feature => (
                                            <li key={feature} className="flex items-center gap-2">
                                                <CheckIcon className="h-4 w-4 text-green-500" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <Button 
                                    onClick={() => handleSelectPlan(plan.name)}
                                    className="w-full" 
                                    variant={plan.recommended ? 'default' : 'outline'}
                                >
                                    {plan.cta}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </main>
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
