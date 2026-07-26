import { useState } from 'react';
import { BarChart, ChevronDown, ClipboardList, Download, FileText, RefreshCw } from 'lucide-react';
import { Button } from '../../common';

interface ResultsActionsProps {
  isMobile: boolean;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  onOpenPhieuPanel: () => void;
  phieuDisabled: boolean;
  onExportCsv: () => void;
  onExportSummary: () => void;
}

export const ResultsActions = ({
  isMobile,
  isRefreshing,
  onRefresh,
  onOpenPhieuPanel,
  phieuDisabled,
  onExportCsv,
  onExportSummary,
}: ResultsActionsProps) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const runExport = (exporter: () => void) => {
    exporter();
    setShowExportMenu(false);
  };

  return (
    <div className={`flex items-center gap-2 ${isMobile ? 'w-full justify-end' : 'ml-auto'}`}>
      <Button
        onClick={onRefresh}
        loading={isRefreshing}
        variant="secondary"
        icon={<RefreshCw className="w-4 h-4" />}
      >
        Làm mới
      </Button>
      <Button
        onClick={onOpenPhieuPanel}
        variant="primary"
        icon={<ClipboardList className="w-4 h-4" />}
        disabled={phieuDisabled}
        title={phieuDisabled ? 'Hãy chọn một lớp và một bài kiểm tra trước khi tạo phiếu.' : undefined}
        className="bg-sky-600 hover:bg-sky-700"
      >
        Tạo và gửi phiếu
      </Button>
      <div className="relative">
        <Button
          onClick={() => setShowExportMenu(previous => !previous)}
          variant="success"
          icon={<Download className="w-4 h-4" />}
        >
          Xuất <ChevronDown className="w-4 h-4 ml-1" />
        </Button>
        {showExportMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border shadow-lg z-50">
              <button
                onClick={() => runExport(onExportCsv)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-xl"
              >
                <FileText className="w-4 h-4 text-green-600" /> Xuất Excel (CSV)
              </button>
              <button
                onClick={() => runExport(onExportSummary)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <BarChart className="w-4 h-4 text-purple-600" /> Báo cáo tổng hợp
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
