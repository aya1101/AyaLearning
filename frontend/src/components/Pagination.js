import React from 'react';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  const handlePrev = () => onPageChange(p => Math.max(p - 1, 1));
  const handleNext = () => onPageChange(p => Math.min(p + 1, totalPages));
  return (
    <div className="mt-6 flex justify-center items-center space-x-4">
      <button onClick={handlePrev} disabled={currentPage === 1} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
        Trước
      </button>
      <span className="font-semibold text-gray-600">
        Trang {currentPage} / {totalPages}
      </span>
      <button onClick={handleNext} disabled={currentPage === totalPages} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
        Sau
      </button>
    </div>
  );
};

export default Pagination;
