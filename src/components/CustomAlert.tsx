import { IonAlert } from "@ionic/react";

interface CustomAlertProps {
  isOpen: boolean;
  onClose: () => void;
  header?: string;
  message: string;
  buttons?: string[]; // optional custom buttons
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  isOpen,
  onClose,
  header = "Notice",
  message,
  buttons = ["OK"],
}) => {
  return (
    <IonAlert
      isOpen={isOpen}
      onDidDismiss={onClose}
      header={header}
      message={message}
      buttons={buttons}
    />
  );
};

export default CustomAlert;
