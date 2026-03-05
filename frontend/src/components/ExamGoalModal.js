import React, { useState } from 'react';
import { buildApiUrl } from '../config/api';

const ExamGoalModal = ({ isOpen, onClose, onSave, authToken }) => {
  const [formData, setFormData] = useState({
    target_exam_date: '',
    target_level: 'N5',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.target_exam_date) {
      setError('Vui lòng chọn ngày thi');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch(buildApiUrl('/exam-goals'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create exam goal');
      }

      const data = await response.json();
      if (onSave) {
        onSave(data.goal);
      }

      setFormData({
        target_exam_date: '',
        target_level: 'N5',
        description: '',
      });
      onClose();
    } catch (err) {
      console.error('Error creating exam goal:', err);
      setError('Lỗi khi lưu mục tiêu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-rose-400 to-red-500 text-white p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Mục tiêu thi</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 w-10 h-10 flex items-center justify-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Target Date */}
            <div>
              <label className="block text-gray-700 font-semibold text-sm mb-2">
                🗓️ Ngày dự định thi *
              </label>
              <input
                type="date"
                name="target_exam_date"
                value={formData.target_exam_date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-rose-400 focus:outline-none transition-colors"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Ví dụ: tháng 7/2026, tháng 12/2026</p>
            </div>

            {/* Target Level */}
            <div>
              <label className="block text-gray-700 font-semibold text-sm mb-2">
                📊 Cấp độ mục tiêu
              </label>
              <select
                name="target_level"
                value={formData.target_level}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-rose-400 focus:outline-none transition-colors"
              >
                <option value="N5">N5 (Sơ cấp)</option>
                <option value="N4">N4 (Sơ trung)</option>
                <option value="N3">N3 (Trung cấp)</option>
                <option value="N2">N2 (Trung cao)</option>
                <option value="N1">N1 (Cao cấp)</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-gray-700 font-semibold text-sm mb-2">
                💭 Mô tả (không bắt buộc)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Ví dụ: Chuẩn bị thi JLPT N5..."
                rows="3"
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-rose-400 focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-400 to-red-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    Lưu mục tiêu
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExamGoalModal;
