// src/services/apiService.ts
import axiosInstance from "./axiosInstance";

const authHeader = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export const getFleetByUsername = async (token: string) => {
  if (!token) throw new Error("Token missing.");
  const response = await axiosInstance.get(
    `/fleet/username`,
    authHeader(token)
  );
  return response.data;
};

export const getRouteById = async (routeId: string, token: string) => {
  if (!routeId || !token) throw new Error("Route ID or token missing.");
  const response = await axiosInstance.get(
    `/routes/route-id/${routeId}`,
    authHeader(token)
  );
  return response.data;
};

export const getStopoversByRouteId = async (routeId: string, token: string) => {
  if (!routeId || !token) throw new Error("Route ID or token missing.");
  const response = await axiosInstance.get(
    `/stopovers/route/${routeId}`,
    authHeader(token)
  );
  return response.data;
};

export const getUnitByCode = async (unitCode: string, token: string) => {
  if (!unitCode || !token) throw new Error("Unit code or token missing.");
  const response = await axiosInstance.get(
    `/units/${unitCode}`,
    authHeader(token)
  );
  return response.data;
};