// utils/previewReceipt.ts
import { TicketPayload } from "../services/ticketService";

export function previewReceipt(ticket: TicketPayload, routeName: string = "") {
    const formatPrice = (value: number | string) =>
        parseFloat(String(value)).toFixed(2);

    const distanceValue = ticket.fixedDistance && ticket.fixedDistance > 0
        ? `${ticket.fixedDistance} km`
        : `${ticket.distance} km`;

    const content = `
        <html>
        <head>
            <style>
                body { font-family: monospace; width: 280px; margin: 20px auto; font-size: 12px; }
                h2 { text-align: center; font-size: 18px; font-weight: bold; margin: 0; }
                pre { font-family: monospace; font-size: 12px; white-space: pre-wrap; margin: 0; }
                .center { text-align: center; }
            </style>
        </head>
        <body>
            <h2>TICKET</h2>
            <pre>
Ticket #:  ${ticket.refNumber}
Plate No:  ${ticket.plateNumber}
------------------------------
${(routeName || `${ticket.pickupAddress} - ${ticket.dropoffAddress}`).replace(' → ', '\n')}
------------------------------
Fare:      Php ${formatPrice(ticket.fare)}
Distance:  ${distanceValue}
Discount:  Php ${formatPrice(ticket.discount)}
Time:   ${ticket.timestamp}

==============================

  Thank you for riding with us!
            </pre>
        </body>
        </html>
    `;

    const win = window.open("", "_blank", "width=350,height=500");
    if (win) {
        win.document.write(content);
        win.document.close();
    }
}