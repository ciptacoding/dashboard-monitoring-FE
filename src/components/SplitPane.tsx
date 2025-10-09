import { useMemo } from 'react';
import { useLayoutPrefs } from '@/state/useLayoutPrefs';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Map, Columns2 } from 'lucide-react';
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
      {/* Quick mode buttons */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-card/95 backdrop-blur px-3 py-2 rounded-lg border border-border shadow-lg">
        <Button
          size="sm"
          variant={splitRatio === 100 ? 'default' : 'ghost'}
          onClick={() => setSplitRatio(100)}
        >
          <LayoutGrid className="h-4 w-4 mr-2" />
          Grid Only
        </Button>
        <Button
          size="sm"
          variant={splitRatio === 50 ? 'default' : 'ghost'}
          onClick={() => setSplitRatio(50)}
        >
          <Columns2 className="h-4 w-4 mr-2" />
          50:50
        </Button>
        <Button
          size="sm"
          variant={splitRatio === 0 ? 'default' : 'ghost'}
          onClick={() => setSplitRatio(0)}
        >
          <Map className="h-4 w-4 mr-2" />
          Map Only
        </Button>
      </div>

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

