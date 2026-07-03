import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveTicket, TicketPayload } from "./ticketService";
import axiosInstance from "./axiosInstance";

vi.mock("./axiosInstance", () => ({
  default: { post: vi.fn() },
}));

const mockedPost = vi.mocked(axiosInstance.post);

const payload: TicketPayload = {
  refNumber: "REF-1",
  unitCode: "U1",
  plateNumber: "ABC-123",
  bodyNumber: "B1",
  routeId: "r1",
  driverUsername: "driver1",
  conductorUsername: "conductor1",
  pickupLoc: { type: "Point", coordinates: [121, 14] },
  dropoffLoc: { type: "Point", coordinates: [121.1, 14.1] },
  pickupAddress: "Pickup",
  dropoffAddress: "Dropoff",
  timestamp: new Date().toISOString(),
  fare: 15,
  distance: 3,
  discount: 0,
};

describe("saveTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the saved ticket data on success", async () => {
    mockedPost.mockResolvedValueOnce({ data: { _id: "t1", refNumber: "REF-1" } });

    const result = await saveTicket(payload, "token123");

    expect(result).toEqual({ _id: "t1", refNumber: "REF-1" });
    expect(mockedPost).toHaveBeenCalledWith(
      "/tickets",
      payload,
      { headers: { Authorization: "Bearer token123" } }
    );
  });

  it("throws the server error payload on failure", async () => {
    mockedPost.mockRejectedValueOnce({
      response: { data: { message: "Duplicate ticket" } },
    });

    await expect(saveTicket(payload, "token123")).rejects.toEqual({
      message: "Duplicate ticket",
    });
  });

  it("throws the raw error when there is no response payload", async () => {
    const networkError = new Error("Network Error");
    mockedPost.mockRejectedValueOnce(networkError);

    await expect(saveTicket(payload, "token123")).rejects.toBe(networkError);
  });
});
