// frontend/src/components/AuthButton.tsx
import React from 'react';

// Define the props interface *without* onLogin
interface AuthButtonProps {
  isAuthenticated: boolean;
  onLogout: () => Promise<void>; // Or void if it doesn't return a promise
  isLoading: boolean;
}

// Use the interface
const AuthButton = ({ isAuthenticated, onLogout, isLoading }: AuthButtonProps) => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const handleLoginClick = () => {
    // Redirect the user to the backend's login route
    if (backendUrl) { // Good practice to check if URL exists
      window.location.href = `${backendUrl}/auth/login`;
    } else {
      console.error("Backend URL not configured!");
      alert("Error: Cannot initiate login. Backend URL missing.");
    }
  };

  if (isLoading) {
    return <button className="px-4 py-2 bg-gray-300 text-gray-600 rounded cursor-not-allowed" disabled>Loading...</button>;
  }

  return (
    <div>
      {isAuthenticated ? (
        <button
          onClick={onLogout} // Use the passed logout handler
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout from GSC
        </button>
      ) : (
        <button
          onClick={handleLoginClick} // Use the internal handler
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Login with Google (GSC)
        </button>
      )}
    </div>
  );
};

export default AuthButton;