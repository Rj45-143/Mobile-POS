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
import axios from "axios";
import "@theme/variables.css";
import { useAuth } from "../contexts/AuthContext";
import { useHistory } from "react-router-dom";
import { eyeOffOutline, eyeOutline } from "ionicons/icons";
import Loading from "../components/Loading";

type View = "login" | "forgot" | "reset" | "change";

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
  const [pendingLoginData, setPendingLoginData] = useState<any>(() => {
    const stored = sessionStorage.getItem("pendingLoginData");
    return stored ? JSON.parse(stored) : null;
  });

  const handleLogin = async () => {
    const username = mobileRef.current?.value as string;
    const password = passwordRef.current?.value as string;

    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_ENDPOINT}/auth/login`,
        { username, password }
      );

      const data = response.data;

      if (data?.user?.mustChangePassword === true) {
        setPendingLoginData(data);
        setChangeUsername(username);
        sessionStorage.setItem("loginView", "change");
        sessionStorage.setItem("pendingLoginData", JSON.stringify(data));
        sessionStorage.setItem("changeUsername", username);
        setView("change");
        return;
      }

      await login(data);
      history.push("/home");
    } catch (error: any) {
      setError(error.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotUsername.trim()) {
      setError("Please enter your username.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await axios.post(
        `${import.meta.env.VITE_API_ENDPOINT}/auth/forgot-password`,
        { username: forgotUsername }
      );
      setSuccessMsg("OTP sent! Please check your registered mobile number.");
      setResetUsername(forgotUsername);
      setForgotUsername("");
      setView("reset");
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUsername.trim() || !otp.trim() || !newPassword.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await axios.post(
        `${import.meta.env.VITE_API_ENDPOINT}/auth/reset-password`,
        { username: resetUsername, otp, newPassword }
      );
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
    if (!changeNewPassword.trim() || !changeConfirmPassword.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (changeNewPassword !== changeConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (changeNewPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await axios.post(
        `${import.meta.env.VITE_API_ENDPOINT}/auth/change-password`,
        {
          identifier: changeUsername,
          newPassword: changeNewPassword,
          mustChangePassword: false,
        },
        {
          headers: {
            Authorization: `Bearer ${pendingLoginData?.access_token}`,
          },
        }
      );

      setSuccessMsg("Password changed successfully! Please log in with your new password.");
      sessionStorage.removeItem("loginView");
      sessionStorage.removeItem("pendingLoginData");
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
                  className="floating-label-dark"
                />
                <IonIcon
                  slot="end"
                  icon={showPassword ? eyeOffOutline : eyeOutline}
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{ cursor: "pointer", fontSize: "1.4rem" }}
                />
              </IonItem>

              <IonButton
                className="custom-button"
                expand="full"
                shape="round"
                size="default"
                onClick={handleLogin}
              >
                Sign In
              </IonButton>

              <IonButton
                expand="full"
                fill="clear"
                size="small"
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
                  className="floating-label-dark"
                  value={forgotUsername}
                  onIonInput={(e: CustomEvent<{ value?: string | null }>) =>
                    setForgotUsername(e.detail.value ?? "")
                  }
                />
              </IonItem>

              <IonButton
                className="custom-button"
                expand="full"
                shape="round"
                size="default"
                onClick={handleForgotPassword}
              >
                Send OTP
              </IonButton>

              <IonButton
                expand="full"
                fill="clear"
                size="small"
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
                  className="floating-label-dark"
                  value={newPassword}
                  onIonInput={(e: CustomEvent<{ value?: string | null }>) =>
                    setNewPassword(e.detail.value ?? "")
                  }
                />
                <IonIcon
                  slot="end"
                  icon={showNewPassword ? eyeOffOutline : eyeOutline}
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  style={{ cursor: "pointer", fontSize: "1.4rem" }}
                />
              </IonItem>

              <IonButton
                className="custom-button"
                expand="full"
                shape="round"
                size="default"
                onClick={handleResetPassword}
              >
                Reset Password
              </IonButton>

              <IonButton
                expand="full"
                fill="clear"
                size="small"
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
                  className="floating-label-dark"
                  value={changeConfirmPassword}
                  onIonInput={(e: CustomEvent<{ value?: string | null }>) =>
                    setChangeConfirmPassword(e.detail.value ?? "")
                  }
                />
                <IonIcon
                  slot="end"
                  icon={showConfirmPassword ? eyeOffOutline : eyeOutline}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  style={{ cursor: "pointer", fontSize: "1.4rem" }}
                />
              </IonItem>

              <IonButton
                className="custom-button"
                expand="full"
                shape="round"
                size="default"
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