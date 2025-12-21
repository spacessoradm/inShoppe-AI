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
  const { user, signOut, profile, isWhatsAppConnected } = useAuth();
  const plan = profile?.plan;
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  return (
    <div className="grid h-screen w-full md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <aside className="hidden flex-col border-r border-slate-800 bg-slate-900 md:flex">
        {/* App Name */}
        <div className="flex h-14 items-center border-b border-slate-800 px-4 lg:h-[60px] lg:px-6">
          <Link to="/console" className="flex items-center gap-2 font-semibold text-white">
            <MessageSquare className="h-6 w-6 text-primary" />
            <span>inShoppe AI</span>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="grid items-start px-2 text-sm font-medium gap-1 lg:px-4">
            <NavLink 
              to="/console/dashboard" 
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActive ? "bg-primary text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <HomeIcon className="h-4 w-4" />
              Dashboard
            </NavLink>
             <NavLink 
              to="/console/crm" 
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActive ? "bg-primary text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <BriefcaseIcon className="h-4 w-4" />
              CRM & Leads
            </NavLink>
            <NavLink 
              to="/console/chat" 
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActive ? "bg-primary text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <UsersIcon className="h-4 w-4" />
              Chats
            </NavLink>
             <NavLink 
              to="/console/wba" 
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActive ? "bg-primary text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <GlobeIcon className="h-4 w-4" />
              WBA Chat
            </NavLink>
            <NavLink 
              to="/console/ai-chat" 
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActive ? "bg-primary text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <BotIcon className="h-4 w-4" />
              AI Chat
            </NavLink>
            <NavLink 
              to="/console/settings" 
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                isActive ? "bg-primary text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <SettingsIcon className="h-4 w-4" />
              Settings
            </NavLink>
          </nav>

          {/* Chat Sessions List */}
          {isWhatsAppConnected && (
            <div className="mt-6">
              <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Sessions
              </h3>
              <nav className="grid gap-1 px-2">
                {mockChatSessions.map((session) => (
                  <NavLink
                    key={session.id}
                    to={`/console/chat/${session.id}`}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 transition-all",
                      isActive ? "bg-slate-800/80 text-white shadow-sm ring-1 ring-slate-700" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                    )}
                  >
                    <div className="relative shrink-0">
                        <img 
                          src={session.avatarUrl} 
                          alt={session.customerName} 
                          className="w-9 h-9 rounded-full border border-slate-700 object-cover" 
                        />
                         {session.unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ring-2 ring-slate-900">
                                {session.unreadCount}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex justify-between items-baseline">
                          <p className="font-medium truncate text-sm">{session.customerName}</p>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{session.lastMessage}</p>
                    </div>
                  </NavLink>
                ))}
              </nav>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 lg:h-[60px] lg:px-6 z-20">
          <div className="flex-1">
             {/* Breadcrumbs or spacer */}
          </div>
          <div className="flex items-center gap-4">
            {plan && (
              <Badge variant="outline" className="border-slate-700 text-slate-300">
                {plan} Plan
              </Badge>
            )}
            <div className="h-4 w-px bg-slate-700 mx-1"></div>
            <span className="text-sm text-slate-400 font-medium">{user?.email}</span>
            <Button 
              onClick={handleSignOut} 
              variant="ghost" 
              size="sm" 
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              Logout
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

// --- Icon Components ---

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

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
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

export default ConsoleLayout;