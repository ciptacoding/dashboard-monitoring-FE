import { useLayoutPrefs } from '@/state/useLayoutPrefs';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Map, Columns2 } from 'lucide-react';
import Split from 'react-split';

interface SplitPaneProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
}

export const SplitPane = ({ leftPane, rightPane }: SplitPaneProps) => {
  const { splitRatio, setSplitRatio } = useLayoutPrefs();

  const handleDrag = (sizes: number[]) => {
    setSplitRatio(sizes[0]);
  };

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
        <Split
          className="flex h-full"
          sizes={[splitRatio, 100 - splitRatio]}
          minSize={[300, 300]}
          gutterSize={8}
          onDragEnd={handleDrag}
          cursor="col-resize"
        >
          <div className="h-full overflow-hidden">{leftPane}</div>
          <div className="h-full overflow-hidden">{rightPane}</div>
        </Split>
      )}
    </div>
  );
};
