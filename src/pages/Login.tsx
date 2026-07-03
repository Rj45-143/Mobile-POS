// src/pages/Login.tsx
import React, { useRef, useState, useEffect } from "react";
import {
  IonButton,
  IonContent,
  IonPage,
  IonInput,
  IonToast,
  IonItem,
  IonImg,
  IonLabel,
  IonHeader,
  IonToolbar,
  IonIcon,
} from "@ionic/react";
import "@theme/variables.css";
import { useAuth } from "../contexts/AuthContext";
import { useHistory } from "react-router-dom";
import { eyeOffOutline, eyeOutline } from "ionicons/icons";
import Loading from "../components/Loading";
import { login as loginRequest, forgotPassword, resetPassword, changePassword, LoginResponse } from "../services/apiService";

type View = "login" | "forgot" | "reset" | "change";

// ── TTL para sa naka-stash na pendingLoginData sa sessionStorage ──
// Kung naiwan ng user ang "force change password" flow nang matagal
// (e.g. binaba ang app, hindi na bumalik), hindi natin gustong manatiling
// "buhay" ang access_token na naka-store dito indefinitely. 15 minutes
// ay sapat na window para tapusin ang flow.
const PENDING_LOGIN_TTL_MS = 15 * 60 * 1000;

const Login: React.FC = () => {
  const { login, isAuthenticated, initialized } = useAuth();
  const history = useHistory();

  const [view, setView] = useState<View>(() => (sessionStorage.getItem("loginView") as View) ?? "login");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const mobileRef = useRef<HTMLElement & { value?: string | number | null }>(null);
  const passwordRef = useRef<HTMLElement & { value?: string | number | null }>(null);

  const [forgotUsername, setForgotUsername] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [changeUsername, setChangeUsername] = useState(() => sessionStorage.getItem("changeUsername") ?? "");
  const [changeNewPassword, setChangeNewPassword] = useState("");
  const [changeConfirmPassword, setChangeConfirmPassword] = useState("");

  // ── Pending login data with TTL check ──
  // Kung expired na ang naka-stash na entry (mas matanda sa
  // PENDING_LOGIN_TTL_MS), itinatapon ito agad at ibabalik sa "login"
  // view ang user — hindi natin pinananatili ang lumang token.
  const [pendingLoginData, setPendingLoginData] = useState<LoginResponse | null>(() => {
    const stored = sessionStorage.getItem("pendingLoginData");
    const storedAt = Number(sessionStorage.getItem("pendingLoginDataAt") ?? 0);
    if (stored && storedAt && Date.now() - storedAt < PENDING_LOGIN_TTL_MS) {
      return JSON.parse(stored);
    }
    if (stored) {
      // expired — linisin lahat ng related na keys
      sessionStorage.removeItem("pendingLoginData");
      sessionStorage.removeItem("pendingLoginDataAt");
      sessionStorage.removeItem("changeUsername");
      sessionStorage.removeItem("loginView");
    }
    return null;
  });

  const handleLogin = async () => {
    const username = (mobileRef.current?.value as string)?.trim();
    const password = (passwordRef.current?.value as string)?.trim();

    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await loginRequest(username, password);

      if (data?.user?.mustChangePassword === true) {
        setPendingLoginData(data);
        setChangeUsername(username);
        sessionStorage.setItem("loginView", "change");
        sessionStorage.setItem("pendingLoginData", JSON.stringify(data));
        sessionStorage.setItem("pendingLoginDataAt", String(Date.now()));
        sessionStorage.setItem("changeUsername", username);
        setView("change");
        return;
      }

      await login(data);
      // ── IMPORTANT: replace, hindi push ──
      // Dating `history.push("/home")` ito — pero ang `push` ay nag-iiwan
      // ng Login bilang isang entry pa rin sa navigation stack SA ILALIM
      // ng Home. Kaya pagka-login, kapag pinindot ang back (hardware o
      // gesture), `ionRouter.canGoBack()` sa Home ay nagiging `true`,
      // at ang DEFAULT back-button handler ng Ionic ay direktang
      // gumagawa ng `goBack()` papunta dito sa Login — walang
      // confirmation, kasabay pa ito ng race kontra sa custom back-button
      // handler natin sa Home.
      //
      // Sa `replace`, mapapalitan ang Login entry mismo ng Home sa
      // history stack — hindi na ito maiiwan sa ilalim. Kaya pagdating sa
      // Home, magiging `false` na ang `canGoBack()`, at ang tamang Exit
      // App confirmation (sa Home.tsx) ang lalabas sa back press, hindi
      // basta-basta bumalik dito sa Login.
      history.replace("/home");
    } catch (error: any) {
      setError(error.response?.data?.message || "Login failed. Please try again.");
      // Panatilihin ang username, linisin ang password field — security
      // best practice na hindi naiiwan ang maling password sa form.
      if (passwordRef.current) {
        passwordRef.current.value = "";
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const username = forgotUsername.trim();
    if (!username) {
      setError("Please enter your username.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await forgotPassword(username);
      setSuccessMsg("OTP sent! Please check your registered mobile number.");
      setResetUsername(username);
      setForgotUsername("");
      setView("reset");
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const username = resetUsername.trim();
    const otpTrimmed = otp.trim();
    const password = newPassword.trim();

    if (!username || !otpTrimmed || !password) {
      setError("Please fill in all fields.");
      return;
    }
    // Pareho ng rule sa "change password" flow — consistent ang
    // minimum length requirement sa lahat ng entry points papunta sa
    // pagpapalit ng password.
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await resetPassword(username, otpTrimmed, password);
      setSuccessMsg("Password reset successful! Please log in with your new password.");
      setOtp("");
      setNewPassword("");
      setResetUsername("");
      setView("login");
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const password = changeNewPassword.trim();
    const confirm = changeConfirmPassword.trim();

    if (!password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await changePassword(changeUsername, password, pendingLoginData?.access_token ?? "");

      setSuccessMsg("Password changed successfully! Please log in with your new password.");
      sessionStorage.removeItem("loginView");
      sessionStorage.removeItem("pendingLoginData");
      sessionStorage.removeItem("pendingLoginDataAt");
      sessionStorage.removeItem("changeUsername");
      setChangeUsername("");
      setPendingLoginData(null);
      setView("login");
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to change password. Please try again.");
    } finally {
      setLoading(false);
      setChangeNewPassword("");
      setChangeConfirmPassword("");
    }
  };

  const goBack = (to: View) => {
    setError("");
    setView(to);
  };

  useEffect(() => {
    if (initialized && isAuthenticated) {
      history.replace("/home");
    }
  }, [initialized, isAuthenticated, history]);

  useEffect(() => {
    if (sessionStorage.getItem("sessionExpired")) {
      sessionStorage.removeItem("sessionExpired");
      setError("Your session has expired. Please log in again.");
    }
  }, []);

  // ── Enter/Go key submission helper ──
  // Pinapayagan ang pag-submit gamit ang "Go"/"Enter" key sa keyboard
  // (mobile at desktop), hindi na kailangang i-tap mismo ang button.
  const handleEnterKey = (action: () => void) => (e: CustomEvent) => {
    const keyEvent = (e as any).detail?.event ?? (e as unknown as KeyboardEvent);
    if (keyEvent?.key === "Enter") {
      action();
    }
  };

  const loadingMessage =
    view === "forgot" ? "Sending OTP..." :
      view === "reset" ? "Resetting password..." :
        view === "change" ? "Changing password..." :
          "Logging in...";

  return (
    <IonPage>
      <IonHeader collapse="fade" className="ion-no-border">
        <IonToolbar>
          <IonLabel slot="end" style={{ margin: "10px", fontSize: "12px" }}>
            v{import.meta.env.VITE_CURRENT_VERSION}
          </IonLabel>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen scrollY={true}>
        <IonImg src="/assets/logo-minibus.png" className="logo-image" />

        <div style={{ paddingBottom: "300px" }}>

          {/* ── LOGIN ── */}
          {view === "login" && (
            <>
              <IonItem lines="none" className="input-field">
                <IonInput
                  ref={mobileRef as any}
                  color="dark"
                  placeholder="jdelacruz123"
                  label="Username"
                  labelPlacement="floating"
                  type="text"
                  inputmode="text"
                  autocomplete="username"
                  enterkeyhint="next"
                  className="floating-label-dark"
                />
              </IonItem>

              <IonItem lines="none" className="input-field">
                <IonInput
                  ref={passwordRef as any}
                  color="dark"
                  placeholder="Password"
                  label="Password"
                  labelPlacement="floating"
                  type={showPassword ? "text" : "password"}
                  autocomplete="current-password"
                  enterkeyhint="go"
                  onKeyDown={handleEnterKey(handleLogin) as any}
                  className="floating-label-dark"
                />
                <IonIcon
                  slot="end"
                  icon={showPassword ? eyeOffOutline : eyeOutline}
                  onClick={() => setShowPassword((prev) => !prev)}
                  role="button"
                  tabIndex={0}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") setShowPassword((prev) => !prev);
                  }}
                  style={{ cursor: "pointer", fontSize: "1.4rem" }}
                />
              </IonItem>

              <IonButton
                className="custom-button"
                expand="full"
                shape="round"
                size="default"
                disabled={loading}
                onClick={handleLogin}
              >
                Sign In
              </IonButton>

              <IonButton
                expand="full"
                fill="clear"
                size="small"
                disabled={loading}
                onClick={() => goBack("forgot")}
                style={{ marginTop: "8px" }}
              >
                Forgot Password?
              </IonButton>
            </>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {view === "forgot" && (
            <>
              <IonItem lines="none" className="input-field">
                <IonInput
                  color="dark"
                  placeholder="jdelacruz123"
                  label="Username"
                  labelPlacement="floating"
                  type="text"
                  autocomplete="username"
                  enterkeyhint="go"
                  className="floating-label-dark"
                  value={forgotUsername}
                  onIonInput={(e: CustomEvent<{ value?: string | null }>) =>
                    setForgotUsername(e.detail.value ?? "")
                  }
                  onKeyDown={handleEnterKey(handleForgotPassword) as any}
                />
              </IonItem>

              <IonButton
                className="custom-button"
                expand="full"
                shape="round"
                size="default"
                disabled={loading}
                onClick={handleForgotPassword}
              >
                Send OTP
              </IonButton>

              <IonButton
                expand="full"
                fill="clear"
                size="small"
                disabled={loading}
                onClick={() => goBack("login")}
                style={{ marginTop: "8px" }}
              >
                Back to Login
              </IonButton>
            </>
          )}

          {/* ── RESET PASSWORD ── */}
          {view === "reset" && (
            <>
              <IonItem lines="none" className="input-field">
                <IonInput
                  color="dark"
                  placeholder="jdelacruz123"
                  label="Username"
                  labelPlacement="floating"
                  type="text"
                  autocomplete="username"
                  className="floating-label-dark"
                  value={resetUsername}
                  onIonInput={(e: CustomEvent<{ value?: string | null }>) =>
                    setResetUsername(e.detail.value ?? "")
                  }
                />
              </IonItem>

              <IonItem lines="none" className="input-field">
                <IonInput
                  color="dark"
                  placeholder="123456"
                  label="OTP"
                  labelPlacement="floating"
                  type="number"
                  autocomplete="one-time-code"
                  className="floating-label-dark"
                  value={otp}
                  onIonInput={(e: CustomEvent<{ value?: string | null }>) =>
                    setOtp(e.detail.value ?? "")
                  }
                />
              </IonItem>

              <IonItem lines="none" className="input-field">
                <IonInput
                  color="dark"
                  placeholder="New Password"
                  label="New Password"
                  labelPlacement="floating"
                  type={showNewPassword ? "text" : "password"}
                  autocomplete="new-password"
                  enterkeyhint="go"
                  className="floating-label-dark"
                  value={newPassword}
                  onIonInput={(e: CustomEvent<{ value?: string | null }>) =>
                    setNewPassword(e.detail.value ?? "")
                  }
                  onKeyDown={handleEnterKey(handleResetPassword) as any}
                />
                <IonIcon
                  slot="end"
                  icon={showNewPassword ? eyeOffOutline : eyeOutline}
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  role="button"
                  tabIndex={0}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") setShowNewPassword((prev) => !prev);
                  }}
                  style={{ cursor: "pointer", fontSize: "1.4rem" }}
                />
              </IonItem>

              <IonButton
                className="custom-button"
                expand="full"
                shape="round"
                size="default"
                disabled={loading}
                onClick={handleResetPassword}
              >
                Reset Password
              </IonButton>

              <IonButton
                expand="full"
                fill="clear"
                size="small"
                disabled={loading}
                onClick={() => goBack("forgot")}
                style={{ marginTop: "8px" }}
              >
                Back
              </IonButton>
            </>
          )}

          {/* ── CHANGE PASSWORD (forced on first login) ── */}
          {view === "change" && (
            <>
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <IonLabel style={{
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#492ee0",
                  display: "block",
                  marginBottom: "4px",
                }}>
                  Change Your Password
                </IonLabel>
                <IonLabel style={{ fontSize: "13px", color: "#666" }}>
                  Your account is using a default password. Please set a new one to continue.
                </IonLabel>
              </div>

              <IonItem lines="none" className="input-field">
                <IonInput
                  color="dark"
                  placeholder="New Password"
                  label="New Password"
                  labelPlacement="floating"
                  type={showNewPassword ? "text" : "password"}
                  autocomplete="new-password"
                  className="floating-label-dark"
                  value={changeNewPassword}
                  onIonInput={(e: CustomEvent<{ value?: string | null }>) =>
                    setChangeNewPassword(e.detail.value ?? "")
                  }
                />
                <IonIcon
                  slot="end"
                  icon={showNewPassword ? eyeOffOutline : eyeOutline}
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  role="button"
                  tabIndex={0}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") setShowNewPassword((prev) => !prev);
                  }}
                  style={{ cursor: "pointer", fontSize: "1.4rem" }}
                />
              </IonItem>

              <IonItem lines="none" className="input-field">
                <IonInput
                  color="dark"
                  placeholder="Confirm Password"
                  label="Confirm Password"
                  labelPlacement="floating"
                  type={showConfirmPassword ? "text" : "password"}
                  autocomplete="new-password"
                  enterkeyhint="go"
                  className="floating-label-dark"
                  value={changeConfirmPassword}
                  onIonInput={(e: CustomEvent<{ value?: string | null }>) =>
                    setChangeConfirmPassword(e.detail.value ?? "")
                  }
                  onKeyDown={handleEnterKey(handleChangePassword) as any}
                />
                <IonIcon
                  slot="end"
                  icon={showConfirmPassword ? eyeOffOutline : eyeOutline}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  role="button"
                  tabIndex={0}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") setShowConfirmPassword((prev) => !prev);
                  }}
                  style={{ cursor: "pointer", fontSize: "1.4rem" }}
                />
              </IonItem>

              <IonButton
                className="custom-button"
                expand="full"
                shape="round"
                size="default"
                disabled={loading}
                onClick={handleChangePassword}
              >
                Set New Password
              </IonButton>
            </>
          )}

        </div>

        <Loading isOpen={loading} message={loadingMessage} />

        <IonToast
          isOpen={!!error}
          message={error}
          duration={3000}
          color="danger"
          position="top"
          onDidDismiss={() => setError("")}
        />

        <IonToast
          isOpen={!!successMsg}
          message={successMsg}
          duration={4000}
          color="success"
          position="top"
          onDidDismiss={() => setSuccessMsg("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;