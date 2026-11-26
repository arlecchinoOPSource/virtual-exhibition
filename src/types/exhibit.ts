export type ExhibitAnchor =
  `Exhibit_${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18'}`;

// The six sections of the exhibition (docs/DESIGN.md), three frames each.
export type Section =
  'studio' | 'street' | 'reading' | 'living' | 'theater' | 'basement';

interface ExhibitDetails {
  anchor: ExhibitAnchor;
  section: Section;
  title: string;
  description: string;
}

export type Exhibit = ExhibitDetails &
  (
    | { status: 'placeholder' | 'awaiting-assets'; image: null; pdf: null }
    | { status: 'ready'; image: string; pdf: string | null }
  );
