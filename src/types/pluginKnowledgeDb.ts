export interface PluginKnowledgeDb {
  generatedAt: string;
  version: number;
  plugins: PluginKnowledgeEntry[];
}

export interface PluginKnowledgeEntry {
  uri: string;
  name: string;
  category: string | null;
  summary: {
    purpose: string;
    useWhen: string;
    differsFrom: string;
  };
  roles: string[];
  goodFor: string[];
  warnings: string[];
  parameterMeanings: Array<{
    symbol: string;
    meaning: string;
  }>;
  safeRanges: Array<{
    symbol: string;
    min: number;
    max: number;
  }>;
  knownLimitations: string[];
  plannerNotes: string[];
}
