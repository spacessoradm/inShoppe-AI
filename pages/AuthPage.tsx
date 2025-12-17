
import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';

const AuthPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen w-full bg-white font-sans text-slate-900">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24 xl:px-32 relative bg-white z-10 py-12">
        {/* Logo */}
        <div className="absolute top-8 left-8 md:left-16 lg:left-24 xl:left-32">
            <div className="flex items-center gap-2">
                 {/* Reusing the brand color for the logo icon, but text is dark per auth page design */}
                 <MessageSquare className="h-6 w-6 text-[#1e293b]" />
                 <span className="text-xl font-bold text-[#1e293b]">inShoppe AI</span>
            </div>
        </div>

        <div className="max-w-[400px] w-full mx-auto mt-12 lg:mt-0">
          <h1 className="text-3xl font-bold text-[#1e293b] mb-1">Welcome back!</h1>
          
          <Button variant="outline" className="w-full h-12 text-slate-700 border-slate-200 hover:bg-slate-50 mt-8 flex items-center justify-center gap-2 font-medium bg-white shadow-sm transition-all">
            <GoogleIcon className="w-5 h-5" />
            Continue with Google
          </Button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-medium tracking-wide">OR</span>
            </div>
          </div>

          <p className="text-slate-600 mb-6 font-medium text-[15px]">Enter your credentials to access the platform.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
               <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm border border-red-100 animate-fadeInUp">
                 {error}
               </div>
            )}
            
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-bold text-slate-800">Email address <span className="text-red-500">*</span></label>
              <Input
                id="email"
                type="email"
                placeholder="john@mail.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 rounded-lg placeholder:text-slate-400 shadow-sm"
              />
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-bold text-slate-800">Password <span className="text-red-500">*</span></label>
              <Input
                id="password"
                type="password"
                placeholder="*************"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-slate-200 bg-white text-slate-900 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 rounded-lg placeholder:text-slate-400 shadow-sm"
              />
            </div>

            <Button className="w-full h-11 text-base font-semibold bg-[#435372] hover:bg-[#2c384d] text-white rounded-lg mt-2 shadow-md transition-all" type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </Button>
          </form>

          <div className="mt-8 space-y-2">
             <div className="flex items-center gap-1 text-sm text-slate-600 font-medium">
                Don't have an account? 
                <span className="text-[#435372] font-bold cursor-pointer hover:underline">Sign up</span>
             </div>
             <div className="text-sm font-bold text-[#435372] cursor-pointer hover:underline inline-block">
                Forgot your password?
             </div>
          </div>
        </div>
      </div>

      {/* Right Side - Illustration */}
      <div className="hidden lg:flex w-1/2 bg-[#EFF5FF] relative flex-col items-center justify-center overflow-hidden">
        {/* Map Illustration Container */}
        <div className="relative w-full h-full flex items-center justify-center p-12">
             
             {/* Abstract Map SVG */}
             <div className="relative w-full max-w-[650px] aspect-[1.6]">
                <svg viewBox="0 0 800 500" className="w-full h-full drop-shadow-2xl opacity-90" style={{ filter: 'drop-shadow(0px 20px 30px rgba(59, 130, 246, 0.15))' }}>
                    {/* Simplified US Map Shape */}
                    <path 
                        d="M50,120 L180,60 L400,60 L550,120 L750,70 L780,180 L720,350 L600,450 L400,480 L200,420 L50,320 Z" 
                        fill="#FFFFFF" 
                        stroke="none"
                    />
                    {/* Grid lines inside map */}
                    <path d="M180,60 L200,420 M400,60 L400,480 M550,120 L600,450" stroke="#F1F5F9" strokeWidth="1" />
                    <path d="M50,200 L780,200 M50,320 L720,320" stroke="#F1F5F9" strokeWidth="1" />
                </svg>

                {/* Floating Markers */}
                {/* Marker 1 */}
                <div className="absolute top-[25%] left-[15%] flex flex-col items-center animate-bounce duration-[3000ms]">
                    <div className="bg-white p-1.5 rounded-lg shadow-[0_8px_16px_rgba(0,0,0,0.1)] flex items-center gap-2 border border-blue-50">
                        <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center text-[10px]">🇺🇸</div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Outside IR35</span>
                    </div>
                    <div className="w-0.5 h-4 bg-blue-200"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full ring-4 ring-blue-100"></div>
                </div>

                {/* Marker 2 */}
                <div className="absolute top-[40%] right-[25%] flex flex-col items-center animate-bounce duration-[4000ms] delay-700">
                    <div className="bg-white p-1.5 rounded-lg shadow-[0_8px_16px_rgba(0,0,0,0.1)] flex items-center gap-2 border border-blue-50">
                        <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center text-[10px]">🇺🇸</div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Payroll</span>
                    </div>
                    <div className="w-0.5 h-4 bg-blue-200"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full ring-4 ring-blue-100"></div>
                </div>

                {/* Marker 3 */}
                <div className="absolute bottom-[35%] left-[45%] flex flex-col items-center animate-bounce duration-[3500ms] delay-300">
                    <div className="bg-white p-1.5 rounded-lg shadow-[0_8px_16px_rgba(0,0,0,0.1)] flex items-center gap-2 border border-blue-50">
                        <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center text-[10px]">🇺🇸</div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Independent Contractor</span>
                    </div>
                    <div className="w-0.5 h-4 bg-blue-200"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full ring-4 ring-blue-100"></div>
                </div>
             </div>
        </div>

        <div className="absolute bottom-16 text-center w-full px-12">
            <p className="text-slate-500 text-sm font-medium mb-8">Trusted by teams at:</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                 {/* Mock Logos - CSS Text Representations */}
                 <div className="flex items-center gap-1 font-bold text-slate-800 text-lg">
                    <span className="text-xl">✦</span> Spark
                 </div>
                 <div className="font-bold text-slate-700 italic text-lg">
                    Alibaba.com
                 </div>
                 <div className="font-bold text-slate-800 text-lg tracking-tight">
                    Soraban
                 </div>
                 <div className="font-extrabold text-slate-800 text-lg">
                    Keeper
                 </div>
                 <div className="flex items-center gap-1 font-bold text-slate-800 text-lg">
                    <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[8px] text-white">V</div>
                    Vori
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// --- SVG Components ---

function MessageSquare(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
      <g transform="matrix(1, 0, 0, 1, 27.009001, -39.23856)">
        <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
        <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
        <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
        <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
      </g>
    </svg>
  );
}

export default AuthPage;
