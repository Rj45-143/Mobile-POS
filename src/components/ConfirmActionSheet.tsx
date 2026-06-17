// ConfirmActionSheet.tsx
import { IonActionSheet } from "@ionic/react";
import React from "react";
import "@theme/variables.css";

type ConfirmActionSheetProps = {
  isOpen: boolean;
  onDismiss: () => void;
  header?: string;
  subHeader?: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  cssClass?: string;
};

const ConfirmActionSheet: React.FC<ConfirmActionSheetProps> = ({
  isOpen,
  onDismiss,
  header = "Are you sure?",
  subHeader = "",
  onConfirm,
  confirmText = "Yes",
  cancelText = "Cancel",
  cssClass = "my-custom-action-sheet",
}) => {
  return (
    <IonActionSheet
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      header={header}
      subHeader={subHeader}
      cssClass={cssClass}
      buttons={[
        {
          text: confirmText,
          handler: onConfirm,
        },
        {
          text: cancelText,
          role: "cancel",
        },
      ]}
    />
  );
};

export default ConfirmActionSheet;
