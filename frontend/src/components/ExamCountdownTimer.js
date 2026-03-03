import React, { useState, useEffect } from 'react';

const ExamCountdownTimer = ({ examGoal }) => {
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    if (!examGoal || !examGoal.target_exam_date) return;

    const updateCountdown = () => {
      const targetDate = new Date(examGoal.target_exam_date).getTime();
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setCountdown({
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
      });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [examGoal]);

  if (!examGoal || !examGoal.target_exam_date) {
    return null;
  }

  const formattedDate = new Date(examGoal.target_exam_date).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border-2 border-amber-200 shadow-md h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm text-gray-600 mb-1">🎯 Mục tiêu thi</p>
          <h3 className="text-xl font-bold text-gray-800">JLPT {examGoal.target_level}</h3>
          <p className="text-sm text-gray-600 mt-1">{formattedDate}</p>
        </div>
        <div className="text-3xl">📅</div>
      </div>

      {!countdown.isExpired ? (
        <>
          {/* Countdown Display */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { value: countdown.days, label: 'Ngày', unit: 'd' },
              { value: countdown.hours, label: 'Giờ', unit: 'h' },
              { value: countdown.minutes, label: 'Phút', unit: 'm' },
              { value: countdown.seconds, label: 'Giây', unit: 's' },
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-lg p-3 text-center border border-amber-200">
                <div className="text-xl sm:text-2xl font-bold text-rose-500">
                  {String(item.value).padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-600 mt-1">{item.unit}</div>
              </div>
            ))}
          </div>

          {/* Motivational Message */}
          <div className="text-center mt-auto">
            <img 
              src="/022Fl.gif" 
              alt="Motivational" 
              className="w-24 h-24 mx-auto mb-2 rounded-lg"
            />
            <p className="text-xl font-bold text-amber-600">
              頑張りましょう！
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Còn <span className="font-bold text-rose-500">{countdown.days}</span> ngày nữa để chuẩn bị
            </p>
          </div>
        </>
      ) : (
        <div className="text-center mt-auto">
          <p className="text-lg font-bold text-red-600 mb-2">🎊 Hôm nay là ngày thi!</p>
          <p className="text-sm text-gray-700">Cố lên! Bạn đẩy đủ chuẩn bị rồi! 💪</p>
        </div>
      )}
    </div>
  );
};

export default ExamCountdownTimer;
