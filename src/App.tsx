import {
  IonApp,
  IonLoading,
  IonRouterOutlet,
  IonSplitPane,
  setupIonicReact,
  useIonAlert,
  useIonRouter,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Redirect, Route, RouteProps, useLocation } from "react-router-dom";
import React, { useEffect } from "react";

import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "./theme/variables.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";


import Login from "./pages/Login";
import Home from "./pages/Home";
import { disableKeepAwake, enableKeepAwake } from "./utils/KeepAwake";

setupIonicReact();

const PrivateRoute: React.FC<{ path: string; exact?: boolean; component: any }> = ({
  component: Component,
  ...rest
}) => {
  const { isAuthenticated, initialized } = useAuth();

  // Prevent rendering before auth state is initialized
  if (!initialized) return null;

  return (
    <Route
      {...rest}
      render={(props) =>
        isAuthenticated ? (
          <Component {...props} />
        ) : (
          <Redirect to="/login" />
        )
      }
    />
  );
};

const AppContentInner: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const router = useIonRouter();
  const [presentAlert] = useIonAlert();

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission().then(permission => {
        console.log("Notification permission:", permission);
      });
    }
  }, []);

  useEffect(() => {
    enableKeepAwake();

    return () => {
      disableKeepAwake();
    };
  }, []);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Handle back button (hardware)
  useEffect(() => {
    const handler = (ev: any) => {
      ev.detail.register(10, () => {
        if (router.canGoBack()) {
          router.goBack();
        } else {
          if (["/home", "/login"].includes(location.pathname)) {
            presentAlert({
              header: "Exit App",
              message: "Are you sure you want to exit?",
              buttons: [
                { text: "Cancel", role: "cancel" },
                {
                  text: "Exit",
                  handler: () => {
                    // @ts-ignore
                    navigator.app?.exitApp?.(); // Cordova/Capacitor exit
                  },
                },
              ],
            });
          }
        }
      });
    };
    document.addEventListener("ionBackButton", handler);
    return () => document.removeEventListener("ionBackButton", handler);
  }, [router, location.pathname, presentAlert]);

  return (
    <IonSplitPane contentId="main">
      <IonRouterOutlet id="main">
        {/* Public Route */}
        <Route path="/login" exact component={Login} />

        {/* Private Route */}
        <PrivateRoute path="/home" exact component={Home} />

        {/* Root Redirect */}
        <Route path="/" exact>
          {!isAuthenticated ? <Redirect to="/login" /> : <Redirect to="/home" />}
        </Route>
      </IonRouterOutlet>
    </IonSplitPane>
  );
};

const AppContent: React.FC = () => (
  <IonReactRouter>
    <AppContentInner />
  </IonReactRouter>
);

const App: React.FC = () => (
  <IonApp>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </IonApp>
);

export default App;
