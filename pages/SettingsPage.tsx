import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';

const SettingsPage: React.FC = () => {
    const { user, plan } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('Merchant Name');

    return (
        <div className="h-full overflow-y-auto p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
                    <p className="text-slate-400">Manage your account preferences and subscription.</p>
                </div>

                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-slate-900/50 border border-slate-700 mb-6">
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                        <TabsTrigger value="billing">Plan & Billing</TabsTrigger>
                        <TabsTrigger value="danger">Danger Zone</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="profile" className="space-y-4">
                         <Card className="border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl text-white">
                            <CardHeader>
                                <CardTitle>User Profile</CardTitle>
                                <CardDescription className="text-slate-400">Manage your profile information.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="name" className="text-sm font-medium">Name</label>
                                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-950/50 border-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium">Email</label>
                                    <Input id="email" value={user?.email || ''} disabled className="bg-slate-950/50 border-slate-700 opacity-70" />
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
                                <CardTitle>Subscription Plan</CardTitle>
                                <CardDescription className="text-slate-400">View your current plan and billing details.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-200">Your current plan is</p>
                                    {plan ? <Badge className="text-lg mt-2 bg-blue-600 hover:bg-blue-500">{plan}</Badge> : <p className="text-muted-foreground">No plan selected.</p>}
                                </div>
                                <Button variant="outline" onClick={() => navigate('/pricing')} className="border-slate-600 hover:bg-slate-800 hover:text-white">Change Plan</Button>
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
                                <p className="font-medium text-slate-200">Delete Account</p>
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