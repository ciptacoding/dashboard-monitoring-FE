import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/state/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';
import logo from '@/assets/images/logo-pantara.png';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      const msg = 'Please fill in all fields';
      setError(msg);
      toast.error(msg)
      return;
    }

    setLoading(true);

    try {
      await login(username.trim(), password);
      toast.success('Login successful');
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Login failed:', err);
      const errorMessage = err.message || 'Login failed. Please check your credential.';
      setError(errorMessage);
      toast.error(errorMessage);
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className='flex justify-center mb-0'>
            <img src={logo} alt="Logo" className="w-24" />
          </div>
          <h1 className="text-3xl font-bold">PANTARA</h1>
          <p className="text-muted-foreground mt-2">
            Dashboard CCTV Berbasis <i>Geographic Information System</i>
          </p>
        </div>

         {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="animate-in fade-in-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='space-y-4'>
            {/* Username */}
            <div className='space-y-2'>
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username"
                type="text" 
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
                required
                autoComplete='username'
                autoFocus
              />
            </div>
            {/* password */}
            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <Input 
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                disabled={loading}
                required
                autoComplete="current-password"
              />
            </div>

            {/* Remember Me */}
            <div className='flex items-center space-x-2'>
              <Checkbox 
                id='remember'
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked as boolean)}
                disabled={loading}
              />
              <Label
                htmlFor="remember"
                className="text-sm font-normal cursor-pointer select-none"      
              >
                Remember me
              </Label>
            </div>
          </div>
          
          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>

          {/* Helper Text */}
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Default test credentials:
            </p>
            <div className="font-mono text-xs bg-muted px-3 py-2 rounded-md">
              <p>
                <span className="text-muted-foreground">Username:</span>{' '}
                <span className="font-semibold">admin</span>
              </p>
              <p>
                <span className="text-muted-foreground">Password:</span>{' '}
                <span className="font-semibold">admin123</span>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
