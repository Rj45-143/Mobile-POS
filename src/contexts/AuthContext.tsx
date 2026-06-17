import React, { createContext, useContext, useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import Loading from "../components/Loading";
import { setAxiosLogout } from "../services/axiosInstance";

interface User {
  _id: string;
  username: string;
  role: string;
  email: string;
  contactNumber: string;
  companyName: string;
  companyId: string;
  status: string;
  isAssign: boolean;
  location: {
    type: string;
    coordinates: number[];
  };
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

interface StoredUser {
  user: User;
  access_token: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  login: (userData: StoredUser) => Promise<void>;
  logout: () => Promise<void>;
  initialized: boolean;
  user: User | null;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log("Checking stored user...");
        const { value } = await Preferences.get({ key: "user" });
        if (value) {
          const parsed: StoredUser = JSON.parse(value);
          console.log("User found in Preferences:", parsed);
          setUser(parsed.user);
          setToken(parsed.access_token);
          setIsAuthenticated(true);
        } else {
          console.log("No stored user found");
        }
      } catch (err) {
        console.error("Error loading user from Preferences:", err);
      } finally {
        setInitialized(true);
      }
    };
    initAuth();
  }, []);

  const login = async (userData: StoredUser) => {
    console.log("Saving user to Preferences:", userData);
    await Preferences.set({
      key: "user",
      value: JSON.stringify(userData),
    });
    setUser(userData.user);
    setToken(userData.access_token);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    setLoading(true);
    try {
      const stored = await Preferences.get({ key: "user" });
      const parsed: StoredUser | null = stored.value
        ? JSON.parse(stored.value)
        : null;

      const token = parsed?.access_token;
      const user = parsed?.user;

      if (user?._id && user?.role && token) {
        await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/auth/logout/${user.role}/${user._id}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      await Preferences.remove({ key: "user" });
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Wire logout to axiosInstance interceptor for automatic 401 handling
  useEffect(() => {
    setAxiosLogout(logout);
  }, [logout]);

  if (!initialized) {
    return <Loading isOpen={true} message="Loading session..." />;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, initialized, user, token }}>
      {children}
      <Loading isOpen={loading} message="Logging out..." />
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};