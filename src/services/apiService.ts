// src/services/apiService.ts
import axiosInstance from "./axiosInstance";

const authHeader = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export interface Stopover {
  name: string;
  idNumber: number;
  location?: {
    type: string;
    coordinates: [number, number];
  };
}

export interface RouteData {
  _id: string;
  routeId?: string;
  terminalPointA?: string;
  terminalPointB?: string;
  minFare?: number;
  farePerKm?: number;
  fareP2P?: number;
  fixedDistance?: number;
  stopOver: Stopover[];
  cumulativeDistances: number[];
}

export interface FleetData {
  _id: string;
  status: string;
  unitCodeDetails?: string;
  assignUnitCode?: string;
  assignedRouteId?: string;
  assignedRouteIdOne?: string;
  assignedDriverId?: string;
}

export interface UnitData {
  unitCode: string;
  plateNumber: string;
  bodyNumber: string;
}

export interface LoginUser {
  _id: string;
  username: string;
  role: string;
  email: string;
  contactNumber: string;
  companyName: string;
  companyId: string;
  status: string;
  isAssign: boolean;
  firstName?: string;
  profileImage?: string;
  mustChangePassword?: boolean;
  location: {
    type: string;
    coordinates: number[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  user: LoginUser;
  access_token: string;
}

export const getFleetByUsername = async (token: string): Promise<FleetData[] | FleetData> => {
  if (!token) throw new Error("Token missing.");
  const response = await axiosInstance.get(
    `/fleet/username`,
    authHeader(token)
  );
  return response.data;
};

export const getRouteById = async (routeId: string, token: string): Promise<RouteData> => {
  if (!routeId || !token) throw new Error("Route ID or token missing.");
  const response = await axiosInstance.get(
    `/routes/route-id/${routeId}`,
    authHeader(token)
  );
  return response.data;
};

export const getStopoversByRouteId = async (routeId: string, token: string): Promise<Stopover[]> => {
  if (!routeId || !token) throw new Error("Route ID or token missing.");
  const response = await axiosInstance.get(
    `/stopovers/route/${routeId}`,
    authHeader(token)
  );
  return response.data;
};

export const getUnitByCode = async (unitCode: string, token: string): Promise<UnitData> => {
  if (!unitCode || !token) throw new Error("Unit code or token missing.");
  const response = await axiosInstance.get(
    `/units/${unitCode}`,
    authHeader(token)
  );
  return response.data;
};

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await axiosInstance.post("/auth/login", { username, password });
  return response.data;
};

export const forgotPassword = async (username: string): Promise<void> => {
  await axiosInstance.post("/auth/forgot-password", { username });
};

export const resetPassword = async (
  username: string,
  otp: string,
  newPassword: string
): Promise<void> => {
  await axiosInstance.post("/auth/reset-password", { username, otp, newPassword });
};

export const changePassword = async (
  identifier: string,
  newPassword: string,
  accessToken: string
): Promise<void> => {
  await axiosInstance.post(
    "/auth/change-password",
    { identifier, newPassword, mustChangePassword: false },
    authHeader(accessToken)
  );
};
