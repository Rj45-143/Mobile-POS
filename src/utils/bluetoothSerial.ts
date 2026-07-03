import { TicketPayload } from "../services/ticketService";

export function createTicketEscPos(
  ticket: TicketPayload,
  companyName: string = "Company Name",
  routeName: string = ""
): { buffer: Uint8Array } {
  const ESC = 0x1b;
  const GS = 0x1d;

  function encodeText(text: string): Uint8Array {
    return new TextEncoder().encode(text);
  }

  function sanitizeText(text: string): string {
    return text
      .replace(/[^\x20-\x7E]/g, "")
      .trim();
  }

  function buildQRCode(data: string): Uint8Array {
    const qrData = new TextEncoder().encode(data);
    const dataLen = qrData.length + 3;
    const pL = dataLen & 0xff;
    const pH = (dataLen >> 8) & 0xff;

    const chunks: Uint8Array[] = [];

    chunks.push(new Uint8Array([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]));
    chunks.push(new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x0A]));
    chunks.push(new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]));
    const storeHeader = new Uint8Array([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]);
    const storeCmd = new Uint8Array(storeHeader.length + qrData.length);
    storeCmd.set(storeHeader);
    storeCmd.set(qrData, storeHeader.length);
    chunks.push(storeCmd);
    chunks.push(new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]));

    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }
    return merged;
  }

  const initPrinter = new Uint8Array([ESC, 0x40]);
  const selectFontB = new Uint8Array([ESC, 0x4d, 0x01]);
  const selectPrintModeHeader = new Uint8Array([ESC, 0x21, 0x38]);
  const resetPrintMode = new Uint8Array([ESC, 0x21, 0x00]);
  const selectFontA = new Uint8Array([ESC, 0x4d, 0x00]);
  const feedAndCut = new Uint8Array([GS, 0x56, 0x41, 0x03]);
  const alignCenter = new Uint8Array([ESC, 0x61, 0x01]);
  const alignLeft = new Uint8Array([ESC, 0x61, 0x00]);

  const formatPrice = (value: number | string) =>
    parseFloat(String(value)).toFixed(2);

  const distanceValue =
    ticket.fixedDistance && ticket.fixedDistance > 0
      ? `${ticket.fixedDistance} km`
      : `${ticket.distance} km`;

  const headerText = `iKomyutPH\n`;

  const ticketText = `Ticket #:  ${ticket.refNumber}
Plate No:  ${ticket.plateNumber}
------------------------------
Route:
  FROM: ${ticket.pickupAddress}
  TO:   ${ticket.dropoffAddress}
------------------------------
Fare:      Php ${formatPrice(ticket.fare)}
Distance:  ${distanceValue}
Discount:  Php ${formatPrice(ticket.discount)}
Time:   ${ticket.timestamp}

==============================
`;
const preQrText = `Scan the QR for your feedback:\n`;

  const footerText = `Thank you for riding with us!\n\n\n\n\n`;

  const FEEDBACK_QR_URL =
    `https://www.ikomyut.com/passenger-feedback` +
    `?plateNumber=${encodeURIComponent(ticket.plateNumber)}` +
    `&refNumber=${encodeURIComponent(ticket.refNumber)}` +
    `&driver=${encodeURIComponent(ticket.driverUsername ?? '')}` +
    `&conductor=${encodeURIComponent(ticket.conductorUsername ?? '')}` +
    `&bodyNumber=${encodeURIComponent(ticket.bodyNumber ?? '')}` +
    `&unitCode=${encodeURIComponent(ticket.unitCode ?? '')}`;

  const qrBytes = buildQRCode(FEEDBACK_QR_URL);

  const encodedHeader = encodeText(headerText);
  const encodedTicket = encodeText(ticketText);
  const encodedPreQr = encodeText(preQrText);
  const encodedFooter = encodeText(footerText);

  const totalLength =
    initPrinter.length +
    alignCenter.length +
    selectPrintModeHeader.length +
    encodedHeader.length +
    resetPrintMode.length +
    alignLeft.length +
    selectFontB.length +
    encodedTicket.length +
    alignCenter.length +
    encodedPreQr.length +
    alignCenter.length +
    qrBytes.length +
    alignCenter.length +
    encodedFooter.length +
    selectFontA.length +
    feedAndCut.length;

  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  const set = (bytes: Uint8Array) => { buffer.set(bytes, offset); offset += bytes.length; };

  set(initPrinter);
  set(alignCenter);
  set(selectPrintModeHeader);
  set(encodedHeader);
  set(resetPrintMode);
  set(alignLeft);
  set(selectFontB);
  set(encodedTicket);
  set(alignCenter);
  set(encodedPreQr);
  set(alignCenter);
  set(qrBytes);
  set(alignCenter);
  set(encodedFooter);
  set(selectFontA);
  set(feedAndCut);

  return { buffer };
}