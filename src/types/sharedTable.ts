export type SummaryCard = {
  id: string;
  label: string;
  value: string;
  tone: 'neutral' | 'positive' | 'warning';
};

export type TableColumn = {
  id: string;
  label: string;
  highlight?: boolean;
};

export type TableRow = {
  id: string;
  cells: Record<string, string>;
  highlighted?: boolean;
};

export type SharedTable = {
  id: string;
  title: string;
  subtitle: string;
  summaryCards: SummaryCard[];
  columns: TableColumn[];
  rows: TableRow[];
  updatedAt: string;
  published: boolean;
};

export type SharedTableDraft = Omit<SharedTable, 'id' | 'updatedAt'> & {
  id?: string;
};

export type TablesResponse = {
  tables: SharedTable[];
};

export type TableResponse = {
  table: SharedTable;
};
