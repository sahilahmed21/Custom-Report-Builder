// frontend/src/components/AuthButton.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Loader2 } from 'lucide-react';

interface AuthButtonProps {
  isAuthenticated: boolean;
  onLogout: () => Promise<void>;
  isLoading: boolean;
}

const AuthButton = ({ isAuthenticated, onLogout, isLoading }: AuthButtonProps) => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const handleLoginClick = () => {
    if (backendUrl) {
      window.location.href = `${backendUrl}auth/login`;
    } else {
      console.error('Backend URL not configured!');
      alert('Error: Cannot initiate login. Backend URL missing.');
    }
  };

  if (isLoading) {
    return (
      <Button
        variant="outline"
        disabled
        className="text-primary-foreground opacity-80 border-primary-foreground/50"
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  return (
    <>
      {isAuthenticated ? (
        <Button variant="destructive" onClick={onLogout} size="sm">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={handleLoginClick}
          size="sm"
          className="text-primary-foreground hover:bg-primary-foreground/10 border-primary-foreground/50"
        >
          <LogIn className="mr-2 h-4 w-4" />
          Login with Google
        </Button>
      )}
    </>
  );
};

export default AuthButton;