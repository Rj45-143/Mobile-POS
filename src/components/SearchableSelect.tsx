import React, { useState } from "react";
import {
  IonModal,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonButton,
  IonContent,
  IonHeader,
  IonToolbar,
} from "@ionic/react";

interface SearchableSelectProps {
  label: string;
  options: { name: string }[];
  value: string;
  onSelect: (value: string) => void;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  options,
  value,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = options
    .map((opt, originalIdx) => ({ ...opt, originalIdx: originalIdx + 1 }))
    .filter((opt) =>
      opt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opt.originalIdx.toString().includes(searchTerm.trim())
    );

  return (
    <>
      <IonItem button onClick={() => setIsOpen(true)}>
        <IonLabel>{label}</IonLabel>
        <div style={{ width: "65%", textAlign: "right", fontWeight: "bold" }}>
          {value || "Select " + label}
        </div>
      </IonItem>

      <IonModal isOpen={isOpen} onDidDismiss={() => setIsOpen(false)}>
        <IonHeader translucent={true}>
          <IonToolbar style={{ paddingTop: "15px" }}>
            <IonSearchbar
              placeholder={`Search ${label}`}
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value!)}
            />
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding" scrollY={true}>
          <IonList style={{ marginTop: "5px" }}>
            {filtered.length > 0 ? (
              filtered.map((opt) => (
                <IonItem
                  key={opt.originalIdx}
                  button
                  onClick={() => {
                    onSelect(opt.name);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <div
                    slot="start"
                    style={{
                      minWidth: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      backgroundColor: "#115830",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      flexShrink: 0,
                    }}
                  >
                    {opt.originalIdx}
                  </div>
                  <IonLabel>{opt.name}</IonLabel>
                </IonItem>
              ))
            ) : (
              <IonItem>
                <IonLabel color="medium">No results found</IonLabel>
              </IonItem>
            )}
          </IonList>

          <IonButton
            expand="block"
            fill="clear"
            color="medium"
            onClick={() => setIsOpen(false)}
          >
            Close
          </IonButton>
        </IonContent>
      </IonModal>
    </>
  );
};

export default SearchableSelect;