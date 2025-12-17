import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';

const SupabaseSetup: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">Supabase Configuration Required</CardTitle>
          <CardDescription>
            Your application isn't connected to a backend. Please follow the steps below to set up Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            To enable authentication and data storage, you need to provide your Supabase Project URL and Anon Key.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Go to <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">supabase.com</a> and create a new project (the free tier is sufficient).</li>
            <li>In your project dashboard, navigate to <strong>Project Settings</strong> (the gear icon) &gt; <strong>API</strong>.</li>
            <li>
              Find your <strong>Project URL</strong> and your <strong>Project API Keys</strong>. You will need the <code className="bg-secondary px-1 py-0.5 rounded text-foreground">anon</code> <code className="bg-secondary px-1 py-0.5 rounded text-foreground">public</code> key.
            </li>
            <li>
              Open the file <code className="bg-secondary px-1 py-0.5 rounded text-foreground">services/supabase.ts</code> in your project's code.
            </li>
            <li>
              Replace the placeholder strings with your actual credentials.
            </li>
          </ol>
          <div className="p-3 bg-secondary rounded-md">
            <pre className="text-xs overflow-x-auto">
              <code>
{`// Before
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY";

// After (example)
const supabaseUrl = "https://xxxxxxxxxxxxxx.supabase.co";
const supabaseAnonKey = "ey...your-key...zA";
`}
              </code>
            </pre>
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            After updating the file, the application will automatically reload.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseSetup;
