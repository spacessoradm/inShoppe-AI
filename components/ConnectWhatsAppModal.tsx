import React from 'react';
import { Button } from './ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';

interface ConnectWhatsAppModalProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onConnect: () => void;
}

export const ConnectWhatsAppModal: React.FC<ConnectWhatsAppModalProps> = ({ isOpen, onOpenChange, onConnect }) => {
    const handleConnect = () => {
        onConnect();
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Connect Your WhatsApp</DialogTitle>
                     <DialogDescription>
                        Follow the steps to link your WhatsApp account.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="scan" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="scan">WhatsApp Web Scan</TabsTrigger>
                        <TabsTrigger value="api" disabled>API Setup (soon)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="scan">
                        <div className="flex flex-col items-center justify-center p-6 gap-4">
                            <img 
                                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=inShoppe-AI-WhatsApp-Connect"
                                alt="WhatsApp QR Code"
                                className="w-48 h-48 bg-gray-200 rounded-lg"
                            />
                            <p className="text-sm text-center text-muted-foreground">
                                Open WhatsApp on your phone, go to Linked Devices and scan this QR code.
                            </p>
                        </div>
                    </TabsContent>
                    <TabsContent value="api">
                        {/* Placeholder for future API setup */}
                    </TabsContent>
                </Tabs>
                <DialogFooter>
                    <Button onClick={handleConnect}>Mark as Connected (Mock)</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
