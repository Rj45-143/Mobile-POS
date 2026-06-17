// src/types/receipt-printer-encoder.d.ts
declare module '@point-of-sale/receipt-printer-encoder' {
  interface EncoderOptions {
    language?: 'esc-pos' | 'star-prnt' | 'star-line';
    codepageMapping?: string;
  }

  export class ReceiptPrinterEncoder {
    constructor(options?: EncoderOptions);
    initialize(): this;
    text(text: string): this;
    newline(): this;
    align(align: 'left' | 'center' | 'right'): this;
    cut(): this;
    encode(): Uint8Array;
  }
}
