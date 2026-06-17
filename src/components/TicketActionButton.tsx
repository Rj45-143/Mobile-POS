import React from 'react';
import { IonButton } from '@ionic/react';

interface TicketActionButtonProps {
    ticketNumber: string | null;
    onGenerate: () => void;
    onSave: () => void;
    onPrint?: () => void;
    disabled?: boolean;

}

const TicketActionButton: React.FC<TicketActionButtonProps> = ({
    ticketNumber,
    onGenerate,
    onSave,
    onPrint,
    disabled = false,
}) => {
    const isTicketGenerated = Boolean(ticketNumber);

    // Wala pang ticket — Generate lang
    if (!isTicketGenerated) {
        return (
            <IonButton
                expand="block"
                color="tertiary"
                className="ion-margin-top"
                onClick={onGenerate}
                disabled={disabled}
            >
                Generate Ticket
            </IonButton>
        );
    }

    // May ticket na — Save & Print (P2P man o hindi)
    if (onPrint) {
        return (
            <IonButton
                expand="block"
                color="primary"
                className="ion-margin-top"
                onClick={onPrint}
                disabled={disabled}
            >
                Save &amp; Print
            </IonButton>
        );
    }

    // Fallback kung walang onPrint prop
    return (
        <IonButton
            expand="block"
            color="secondary"
            className="ion-margin-top"
            onClick={onSave}
            disabled={disabled}
        >
            Save to System
        </IonButton>
    );
};

export default TicketActionButton;