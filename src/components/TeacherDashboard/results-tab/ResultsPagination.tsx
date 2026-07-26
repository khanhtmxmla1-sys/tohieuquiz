interface ResultsPaginationProps {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const ResultsPagination = ({
  currentPage,
  totalPages,
  totalResults,
  pageSize,
  onPageChange,
}: ResultsPaginationProps) => (
  <div className="p-4 border-t flex items-center justify-between bg-gray-50">
    <p className="text-sm text-gray-600">
      Hiển thị {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalResults)} / {totalResults} kết quả
    </p>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm border rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Trước
      </button>
      <span className="text-sm font-medium text-gray-700">Trang {currentPage}/{totalPages}</span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-sm border rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Sau
      </button>
    </div>
  </div>
);
