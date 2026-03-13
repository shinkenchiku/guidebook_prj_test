export interface ArchitectureInit {
  title: string;
  architect: string;
  location: [string, string];
}

export interface ArchitectureMain {
  title: string;
  architect: string;
  region: string;
  address: string;
  completion: string;
  builduse: string[];
  memo: string;
  link: string;
  tags: string[];
  image?: string;
  images?: string[];
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export type MapCommandType = 'FLY_TO' | 'SHOW_ROUTE' | 'FIT_BOUNDS' | 'RESET_VIEW';

export interface MapCommand {
  type: MapCommandType;
  payload: any; // 具体的なペイロードは多岐にわたるため、ここでは一旦anyを許容するか、Union型を定義
}
