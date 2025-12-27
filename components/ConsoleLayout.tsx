
import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ChatSession } from '../types';
import { cn } from '../lib/utils';

const mockChatSessions: ChatSession[] = [
  { id: '1', customerName: 'John Doe', lastMessage: 'Okay, thank you!', avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', unreadCount: 2, phone: '+1-202-555-0104', priority: 'Hot' },
  { id: '2', customerName: 'Jane Smith', lastMessage: 'I have a question about pricing.', avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026705d', unreadCount: 0, phone: '+1-202-555-0176', priority: 'Warm' },
  { id: '3', customerName: 'Sam Wilson', lastMessage: 'Can you call me back?', avatarUrl: 'https://i.pravatar.cc/150?u=a042581f4e29026706d', unreadCount: 0, phone: '+1-202-555-0182', priority: 'Cold' },
];

const ConsoleLayout: React.FC = () => {
  const { user, signOut, organization, profile, isWhatsAppConnected } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
        await signOut();
    } catch (e) {
        console.error("Sign out error:", e);
    } finally {
        navigate('/');
    }
  };

  const orgName = organization?.name || "My Workspace";
  const plan = organization?.plan || "Free";
  const userName = profile?.full_name || user?.email?.split('@')[0] || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="grid h-screen w-full md:grid-cols-[260px_1fr] overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <aside className="hidden flex-col border-r border-slate-800 bg-[#0b101a] md:flex">
        
        {/* Top: Organization Info */}
        <div className="p-4 pb-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:bg-slate-900 hover:border-slate-700 transition-all cursor-pointer group">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/20 shrink-0">
                    <BuildingIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-white truncate">{orgName}</h3>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">{plan} Plan</span>
                        {organization?.subscription_status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span>}
                    </div>
                </div>
                <ChevronRightIcon className="h-4 w-4 text-slate-600 group-hover:text-slate-400" />
            </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Main Group */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Platform</p>
            <NavItem to="/console/dashboard" icon={HomeIcon} label="Dashboard" />
            <NavItem to="/console/crm" icon={BriefcaseIcon} label="CRM & Leads" />
            <NavItem to="/console/ai-chat" icon={BotIcon} label="AI Agent" />
          </div>

          {/* Configuration Group */}
          <div className="space-y-1">
             <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Configuration</p>
             <NavItem to="/console/settings" icon={SettingsIcon} label="Settings" />
          </div>

          {/* Active Chats (Conditional) */}
          {isWhatsAppConnected && (
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Recent Chats
              </p>
              {mockChatSessions.slice(0, 3).map((session) => (
                  <NavLink
                    key={session.id}
                    to={`/console/chat/${session.id}`}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-all group",
                      isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    )}
                  >
                    <div className="relative">
                        <img src={session.avatarUrl} alt="" className="w-6 h-6 rounded-full opacity-70 group-hover:opacity-100" />
                        {session.unreadCount > 0 && <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-[#0b101a]"></div>}
                    </div>
                    <span className="text-sm truncate">{session.customerName}</span>
                  </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: User Profile */}
        <div className="p-4 border-t border-slate-800 bg-[#0b101a]">
            <div className="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-slate-900 group">
                <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 border border-slate-700">
                    {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{userName}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-slate-800" onClick={handleSignOut} title="Sign Out">
                    <LogOutIcon className="h-4 w-4" />
                </Button>
            </div>
            
            {/* Profile Completion Bar */}
            <div className="mt-3 px-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-500">Profile Setup</span>
                    <span className="text-[10px] text-slate-400">70%</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[70%] rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col h-full overflow-hidden relative">
        {/* Simplified Header */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 z-20 justify-between md:justify-end">
           {/* Mobile Toggle Placeholder (Hidden on Desktop) */}
           <div className="md:hidden flex items-center gap-2 font-bold text-white">
              <MessageSquare className="h-6 w-6 text-primary" />
              inShoppe AI
           </div>

           {/* Right side header items (e.g. notifications) */}
           <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                  <BellIcon className="h-5 w-5" />
                  <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full"></span>
              </Button>
           </div>
        </header>

        {/* Dynamic Background Area */}
        <main className="flex-1 overflow-hidden relative bg-slate-950">
             {/* Decorative Background Elements */}
             <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black opacity-80"></div>
             <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/5 blur-[100px] pointer-events-none"></div>
             <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[100px] pointer-events-none"></div>
             
             {/* Content Layer */}
             <div className="relative z-10 h-full w-full">
                <Outlet />
             </div>
        </main>
      </div>
    </div>
  );
};

// --- Helper Component ---
const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <NavLink 
        to={to} 
        className={({ isActive }) => cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-sm font-medium",
        isActive 
            ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-700/50" 
            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
        )}
    >
        <Icon className="h-4 w-4" />
        {label}
    </NavLink>
);

// --- Icons ---

function MessageSquare(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BriefcaseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  )
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.4l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.4l.15.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function BotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  )
}

function BuildingIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M12 6h.01" />
            <path d="M12 10h.01" />
            <path d="M12 14h.01" />
            <path d="M16 10h.01" />
            <path d="M16 14h.01" />
            <path d="M8 10h.01" />
            <path d="M8 14h.01" />
        </svg>
    )
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
        </svg>
    )
}

function LogOutIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
    )
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
    )
}

export default ConsoleLayout;
