import React from 'react';

const Modal = ({ open, isOpen, onClose, title, children }) => {
  const visible = typeof isOpen === 'boolean' ? isOpen : open;
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-2xl sm:text-3xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        {title && <h3 className="text-xl font-semibold mb-4 pr-8">{title}</h3>}
        {children}
      </div>
    </div>
  );
};

export default Modal;
