// End-to-end happy path: login → fleet/route load → generate a ticket →
// save it to the backend.
//
// NOTE on scope: the actual thermal-printer flow (BluetoothSerial.connect/
// write) depends on the native Cordova bridge (`window.cordova`), which
// doesn't exist in a desktop browser. Clicking "Save & Print" here will
// still exercise the ticket-save API call (the part that matters for data
// integrity) but will then fail gracefully at the Bluetooth permission step
// with an alert, exactly like it would on a device with Bluetooth off —
// that's the assertion this spec makes. True print-to-hardware coverage
// requires running against a real device/emulator.

const user = {
  _id: "u1",
  username: "conductor1",
  role: "conductor",
  email: "conductor1@example.com",
  contactNumber: "09000000000",
  companyName: "iKomyutPH",
  companyId: "co1",
  status: "Active",
  isAssign: true,
  firstName: "Juan",
  location: { type: "Point", coordinates: [0, 0] },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const fleet = {
  _id: "f1",
  status: "Active",
  unitCodeDetails: "BODY1 | ABC-123 | UNIT1",
  assignUnitCode: "UNIT1",
  assignedRouteId: "r1",
  assignedDriverId: "driver1",
};

const route = {
  _id: "r1",
  routeId: "r1",
  terminalPointA: "Terminal A",
  terminalPointB: "Terminal B",
  minFare: 15,
  farePerKm: 2.5,
};

const stopovers = [
  { name: "Stop 1", idNumber: 1, location: { type: "Point", coordinates: [121, 14] } },
  { name: "Stop 2", idNumber: 2, location: { type: "Point", coordinates: [121.05, 14.05] } },
];

describe("Login -> generate ticket -> save", () => {
  beforeEach(() => {
    cy.intercept("POST", "**/auth/login", {
      statusCode: 200,
      body: { user, access_token: "test-token" },
    }).as("login");

    cy.intercept("GET", "**/fleet/username", { statusCode: 200, body: [fleet] }).as("getFleet");
    cy.intercept("GET", `**/routes/route-id/${route._id}`, { statusCode: 200, body: route }).as("getRoute");
    cy.intercept("GET", `**/stopovers/route/${route._id}`, { statusCode: 200, body: stopovers }).as("getStopovers");
    cy.intercept("PATCH", "**/fleet/*/location", { statusCode: 200, body: {} }).as("updateLocation");
    cy.intercept("POST", "**/tickets", { statusCode: 201, body: { _id: "t1", refNumber: "REF-1" } }).as("saveTicket");
  });

  it("logs in and loads the assigned fleet/route", () => {
    cy.visit("/login");

    cy.get('ion-input[placeholder="jdelacruz123"]').shadow().find("input").type("conductor1");
    cy.get('ion-input[placeholder="Password"]').shadow().find("input").type("password123");
    cy.contains("ion-button", "Sign In").click();

    cy.wait("@login");
    cy.location("pathname").should("eq", "/home");
    cy.wait("@getFleet");
    cy.wait("@getRoute");
    cy.wait("@getStopovers");

    cy.contains("Terminal A").should("be.visible");
  });

  it("generates a ticket from pickup/dropoff and saves it", () => {
    cy.visit("/login");
    cy.get('ion-input[placeholder="jdelacruz123"]').shadow().find("input").type("conductor1");
    cy.get('ion-input[placeholder="Password"]').shadow().find("input").type("password123");
    cy.contains("ion-button", "Sign In").click();
    cy.wait(["@login", "@getFleet", "@getRoute", "@getStopovers"]);

    cy.window().then((win) => cy.stub(win, "alert").as("windowAlert"));

    cy.contains("ion-item", "Pick-up").click();
    cy.get("ion-searchbar").shadow().find("input").type("Stop 1");
    cy.contains("ion-item", "Stop 1").click();

    cy.contains("ion-item", "Drop-off").click();
    cy.get("ion-searchbar").shadow().find("input").type("Stop 2");
    cy.contains("ion-item", "Stop 2").click();

    cy.contains("ion-button", "Generate Ticket").click();

    // Fare = minFare (15) since the two stops are close together — the
    // exact distance depends on getCachedCumulativeDistances, so we assert
    // a ticket number was generated rather than a specific fare figure.
    cy.contains("Ref No.").parents("ion-item").find("strong").invoke("text").should("not.be.empty");
    cy.contains("ion-button", "Save & Print").should("be.visible").click();

    cy.wait("@saveTicket").its("request.body").should((body) => {
      expect(body.pickupAddress).to.eq("Stop 1");
      expect(body.dropoffAddress).to.eq("Stop 2");
    });

    // Bluetooth isn't available in a desktop browser — printing fails
    // gracefully after the save succeeds, instead of crashing the app.
    cy.get("@windowAlert").should("have.been.called");
  });
});
