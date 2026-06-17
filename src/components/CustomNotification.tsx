import { IonToast } from "@ionic/react";

interface CustomNotificationProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
    duration?: number;
    color?: string;
    playSound?: boolean;
}

const CustomNotification: React.FC<CustomNotificationProps> = ({
    isOpen,
    onClose,
    message,
    duration = 3000,
    color = "primary",
    playSound = true,
}) => {
    // Play sound on open
    if (isOpen && playSound) {
        const audio = new Audio("./sounds/car_notif.wav");
        audio.play().catch((err) => console.error("Sound error:", err));
    }

    return (
        <IonToast
            isOpen={isOpen}
            onDidDismiss={onClose}
            message={message}
            duration={duration}
            color={color}
            position="top"
        />
    );
};

export default CustomNotification;
