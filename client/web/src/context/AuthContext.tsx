import React, { createContext, useContext, useState, useEffect } from "react";
import { User, LoginResponse } from "../types";
import { api } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("coop_user_profile");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("coop_jwt_token");
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem("coop_jwt_token");
      if (storedToken) {
        try {
          const res = await api.get<User>("/auth/me");
          setUser(res.data);
          localStorage.setItem("coop_user_profile", JSON.stringify(res.data));
        } catch {
          localStorage.removeItem("coop_jwt_token");
          localStorage.removeItem("coop_user_profile");
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    verifyToken();
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    const response = await api.post<LoginResponse>("/auth/login", {
      username,
      password,
    });

    const { token: receivedToken, user: loggedInUser } = response.data;
    localStorage.setItem("coop_jwt_token", receivedToken);
    localStorage.setItem("coop_user_profile", JSON.stringify(loggedInUser));
    setToken(receivedToken);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    localStorage.removeItem("coop_jwt_token");
    localStorage.removeItem("coop_user_profile");
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
