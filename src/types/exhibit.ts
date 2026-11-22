type ExhibitAnchor =
  `Exhibit_${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12'}`;

interface ExhibitDetails {
  anchor: ExhibitAnchor;
  title: string;
  description: string;
}

export type Exhibit = ExhibitDetails &
  (
    | { status: 'placeholder' | 'awaiting-assets'; image: null; pdf: null }
    | { status: 'ready'; image: string; pdf: string | null }
  );
