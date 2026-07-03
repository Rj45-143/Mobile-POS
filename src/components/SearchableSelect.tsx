import React, { useState, useMemo } from "react";
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
  options: { name: string; idNumber?: number }[];
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

  // Hindi na kailangan ng re-indexing dito — ang `options` na pumapasok
  // dito ay galing na sa stopOver na naka-sort ayon sa idNumber sa
  // Home.tsx, kaya direkta na lang gamitin ang idNumber bilang badge.
  //
  // useMemo: hindi na ito ire-recompute kada re-render ng parent (e.g.
  // mula sa ibang state na walang kinalaman dito) — recompute lang
  // kapag talagang nagbago ang `options` o `searchTerm`.
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(term) ||
        (opt.idNumber !== undefined && opt.idNumber.toString().includes(term))
    );
  }, [options, searchTerm]);

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
            {/* debounce sa IonSearchbar mismo (Stencil-level) sa halip na
                manual setTimeout sa React — mas reliable ito sa pag-iwas
                ng "ghost row" / paulit-ulit na search result na lumalabas
                pag mabilis na nag-type. */}
            <IonSearchbar
              placeholder={`Search ${label}`}
              debounce={300}
              value={searchTerm}
              onIonInput={(e) => setSearchTerm(e.detail.value!)}
            />
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding" scrollY={true}>
          {/* key={`${searchTerm}-${filtered.length}`}: pinipilit nitong
              i-REMOUNT ng React ang buong IonList sa bawat pagbago ng
              search results, sa halip na incremental patch lang sa mga
              Ionic web component (IonItem). Ang mga Ionic/Stencil custom
              elements minsan ay may sariling lifecycle na hindi laging
              kasabay ng React diffing — kaya pag mabilis na nag-type o
              nagbura, naiiwan minsan ang lumang row habang naka-stack na
              ang bago. Ang remount-via-key ang nag-aayos nito. */}
          <IonList key={`${searchTerm}-${filtered.length}`} style={{ marginTop: "5px" }}>
            {filtered.length > 0 ? (
              filtered.map((opt, idx) => (
                <IonItem
                  key={opt.idNumber ?? `${opt.name}-${idx}`}
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
                    {opt.idNumber ?? "•"}
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

// React.memo: hindi na ire-render ulit ang component na ito kapag ang
// parent (Home) ay nag-re-render dahil sa ibang state na walang kinalaman
// dito (e.g. ticket number, loading state), kung walang nagbago sa
// `label`, `options`, `value`, o `onSelect`.
export default React.memo(SearchableSelect);