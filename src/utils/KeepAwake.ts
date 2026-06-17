import { KeepAwake } from "@capacitor-community/keep-awake";

export const enableKeepAwake = async () => {
  try {
    await KeepAwake.keepAwake();
    console.log("Screen will stay on.");
  } catch (error) {
    console.error("Failed to enable keep awake:", error);
  }
};

export const disableKeepAwake = async () => {
  try {
    await KeepAwake.allowSleep();
    console.log("Screen can now sleep.");
  } catch (error) {
    console.error("Failed to disable keep awake:", error);
  }
};
