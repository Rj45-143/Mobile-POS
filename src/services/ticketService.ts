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

export const saveTicket = async (
  ticketData: TicketPayload,
  token: string
): Promise<any | null> => {
  try {
    const response = await axiosInstance.post("/tickets", ticketData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error(
      "Ticket save error:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    throw error.response?.data || error;
  }
};