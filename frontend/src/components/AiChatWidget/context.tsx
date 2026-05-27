import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type AiSurface = 'global' | 'knowledge';

export interface AiWorkbenchPanel {
  key: string;
  label: string;
  content: ReactNode;
}

export interface AiKnowledgeContext {
  surface: 'knowledge';
  documentId?: string;
  documentTitle?: string;
  documentSummary?: string;
  knowledgeMode?: string | number;
  panels: AiWorkbenchPanel[];
}

interface AiWorkbenchContextValue {
  knowledgeContext?: AiKnowledgeContext;
  setKnowledgeContext: (context?: AiKnowledgeContext) => void;
}

const AiWorkbenchContext = createContext<AiWorkbenchContextValue | undefined>(undefined);

export function AiWorkbenchProvider({ children }: { children: ReactNode }) {
  const [knowledgeContext, setKnowledgeContext] = useState<AiKnowledgeContext | undefined>();
  const value = useMemo(() => ({ knowledgeContext, setKnowledgeContext }), [knowledgeContext]);
  return <AiWorkbenchContext.Provider value={value}>{children}</AiWorkbenchContext.Provider>;
}

export function useAiWorkbench() {
  const context = useContext(AiWorkbenchContext);
  if (!context) {
    throw new Error('useAiWorkbench must be used inside AiWorkbenchProvider');
  }
  return context;
}
