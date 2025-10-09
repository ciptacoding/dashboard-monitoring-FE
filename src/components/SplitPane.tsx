import { useMemo } from 'react';
import { useLayoutPrefs } from '@/state/useLayoutPrefs';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface SplitPaneProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
}

export const SplitPane = ({ leftPane, rightPane }: SplitPaneProps) => {
  const { splitRatio, setSplitRatio } = useLayoutPrefs();

  const sizes = useMemo(() => [splitRatio, 100 - splitRatio], [splitRatio]);

  return (
    <div className="relative h-full">
      {splitRatio === 100 ? (
        <div className="h-full">{leftPane}</div>
      ) : splitRatio === 0 ? (
        <div className="h-full">{rightPane}</div>
      ) : (
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={sizes[0]} minSize={20} className="overflow-hidden">
            {leftPane}
          </Panel>
          <PanelResizeHandle className="resize-handle" />
          <Panel defaultSize={sizes[1]} minSize={20} className="overflow-hidden">
            {rightPane}
          </Panel>
        </PanelGroup>
      )}
    </div>
  );
};

