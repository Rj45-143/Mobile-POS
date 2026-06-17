declare module "esc-pos-encoder" {
  export default class EscPosEncoder {
    initialize(): this;
    text(value: string): this;
    newline(): this;
    cut(): this;
    align(value: "left" | "center" | "right"): this;
    encode(): Uint8Array;
  }
}
