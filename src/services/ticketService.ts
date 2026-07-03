// src/services/ticketService.ts
import axiosInstance from "./axiosInstance";

export interface TicketPayload {
  refNumber: string;
  unitCode: string;
  plateNumber: string;
  bodyNumber: string;
  routeId: string;
  driverUsername: string;
  conductorUsername: string;
  pickupLoc: {
    type: "Point";
    coordinates: [number, number];
  };
  dropoffLoc: {
    type: "Point";
    coordinates: [number, number];
  };
  pickupAddress: string;
  dropoffAddress: string;
  timestamp: string;
  fare: number;
  distance: number;
  discount: number;
  fixedDistance?: number;
  routeName?: string;
}

export interface TicketSaveResponse {
  _id: string;
  refNumber: string;
  [key: string]: unknown;
}

export const saveTicket = async (
  ticketData: TicketPayload,
  token: string
): Promise<TicketSaveResponse | null> => {
  try {
    const response = await axiosInstance.post("/tickets", ticketData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    const axiosError = error as { response?: { data?: unknown }; message?: string };
    console.error(
      "Ticket save error:",
      JSON.stringify(axiosError.response?.data || axiosError.message, null, 2)
    );
    throw axiosError.response?.data || error;
  }
};