import { createContext } from "react";
import { User, LoginCredentials, AuthResponse } from "../types/user";

export interface UpdateProfileData {
  displayName: string;
  bio?: string;
  imageUrl?: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);