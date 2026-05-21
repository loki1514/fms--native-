import React, { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Shape of the authentication state used throughout the app.
 */
export type AuthState = {
  user: any | null;
  membership: any | null;
  isLoading: boolean;
  isMembershipLoading: boolean;
};

/**
 * Context with default empty values. Components can consume it via `useAuthContext`.
 */
const AuthContext = createContext<AuthState>({
  user: null,
  membership: null,
  isLoading: true,
  isMembershipLoading: true,
});

/**
 * Provider that forwards the values from the existing `useAuth` hook.
 * It is wrapped around the app in `app/_layout.tsx`.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { user, membership, isLoading, isMembershipLoading } = useAuth();

  return (
    <AuthContext.Provider
      value={{ user, membership, isLoading, isMembershipLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/** Hook for consuming the AuthContext in components. */
export const useAuthContext = () => useContext(AuthContext);

export { AuthContext };
