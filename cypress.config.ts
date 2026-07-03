import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    // Ionic components (ion-input, ion-searchbar, ion-button, ...) render
    // their real interactive elements inside shadow DOM — without this,
    // cy.get()/cy.type() can't reach them at all.
    includeShadowDom: true,
    setupNodeEvents(on, config) {
      // implement node event listeners here
      return config;
    },
  },
});