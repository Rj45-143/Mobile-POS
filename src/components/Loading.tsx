// components/Loading.tsx
import { IonLoading } from "@ionic/react";
import React from "react";
import "../theme/variables.css";

interface LoadingProps {
  isOpen: boolean;
  message?: string;
}

const Loading: React.FC<LoadingProps> = ({ isOpen, message }) => {
  return (
    <IonLoading
      color="green"
      cssClass="loading-spinner"
      mode="ios"
      animated={true}
      duration={0}
      keyboardClose={true}
      showBackdrop={true}
      isOpen={isOpen}
      message={message || "Please wait..."}
      spinner="crescent"
      translucent={true}
      backdropDismiss={false}
    />
  );
};

export default Loading;
