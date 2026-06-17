import React from "react";
import { IonButton, IonIcon } from "@ionic/react";
import { chevronBack } from "ionicons/icons";
import { useHistory } from "react-router-dom";

type BackButtonProps = {
  onClick?: () => void;
  label?: string;
  className?: string;
};

const BackButton: React.FC<BackButtonProps> = ({ onClick }) => {
  const history = useHistory();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      history.goBack();
    }
  };

  return (
    <IonButton
      onClick={handleClick}
      fill="clear"
      size="default"
      aria-label="Go back"
    >
      <IonIcon
        slot="start"
        icon={chevronBack}
        style={{ color: "#008000", fontSize: "2rem" }}
      />
    </IonButton>
  );
};

export default BackButton;
