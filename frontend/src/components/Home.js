import React, { useState, useEffect } from 'react';
import ExamCountdownTimer from './ExamCountdownTimer';

const Home = ({ activeExamGoal, authToken }) => {
  const [stats, setStats] = useState({
    total_study_minutes: 0,
    total_items_studied: 0,
    average_accuracy: 0,
    kanji_learned: 0,
    vocabulary_learned: 0
  });
  const [weeklyActivity, setWeeklyActivity] = useState([
    { day: 'Mon', value: 0 },
    { day: 'Tue', value: 0 },
    { day: 'Wed', value: 0 },
    { day: 'Thu', value: 0 },
    { day: 'Fri', value: 0 },
    { day: 'Sat', value: 0 },
    { day: 'Sun', value: 0 }
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch study stats
        const statsResponse = await fetch('http://localhost:3001/api/study-stats', {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }

        // Fetch game stats for weekly activity
        const gameStatsResponse = await fetch('http://localhost:3001/api/game-stats', {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (gameStatsResponse.ok) {
          const gameStatsData = await gameStatsResponse.json();
          
          // Calculate weekly activity from sessions
          const sessions = gameStatsData.sessions || [];
          const weekActivity = calculateWeeklyActivity(sessions);
          setWeeklyActivity(weekActivity);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (authToken) {
      fetchDashboardData();
    }
  }, [authToken]);

  const calculateWeeklyActivity = (sessions) => {
    const today = new Date();
    const activity = Array(7).fill(0);
    
    sessions.forEach(session => {
      if (session.created_at) {
        const sessionDate = new Date(session.created_at);
        const daysDiff = Math.floor((today - sessionDate) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 0 && daysDiff < 7) {
          activity[6 - daysDiff] += session.items_studied || 1;
        }
      }
    });

    return [
      { day: 'Mon', value: activity[0] },
      { day: 'Tue', value: activity[1] },
      { day: 'Wed', value: activity[2] },
      { day: 'Thu', value: activity[3] },
      { day: 'Fri', value: activity[4] },
      { day: 'Sat', value: activity[5] },
      { day: 'Sun', value: activity[6] }
    ];
  };

  const maxActivity = Math.max(...weeklyActivity.map(a => a.value), 1);
  const studyHours = Math.floor(stats.total_study_minutes / 60);
  const studyMins = stats.total_study_minutes % 60;
  const hasWeeklyActivity = weeklyActivity.some((item) => item.value > 0);
  const streakDays = (() => {
    let count = 0;
    for (let index = weeklyActivity.length - 1; index >= 0; index -= 1) {
      if (weeklyActivity[index].value > 0) {
        count += 1;
      } else {
        break;
      }
    }
    return count;
  })();

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2">Welcome back! 🌸</h1>
          <p className="text-sm sm:text-base text-gray-600">Ready to continue your Japanese journey?</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="xl:col-span-8 space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-xs sm:text-sm">Kanji Learned</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-500 text-sm sm:text-base">📈</span>
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {loading ? '...' : stats.kanji_learned}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-xs sm:text-sm">Vocabulary</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-500 text-sm sm:text-base">📚</span>
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {loading ? '...' : stats.vocabulary_learned}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-xs sm:text-sm">Accuracy</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-500 text-sm sm:text-base">🎯</span>
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {loading ? '...' : Math.round(stats.average_accuracy)}%
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-xs sm:text-sm">Study Time</span>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-500 text-sm sm:text-base">⏱️</span>
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-800">
                  {loading ? '...' : `${studyHours}h ${studyMins}m`}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">Streak</h3>
                <span className="text-sm font-medium text-blue-600">{streakDays} day streak</span>
              </div>
              <div className="flex items-end space-x-2 sm:space-x-4 h-32">
                {weeklyActivity.map((item, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div
                      className="bg-gradient-to-t from-blue-500 to-blue-400 rounded-t w-full mb-2 transition-all duration-300 hover:from-blue-600 hover:to-blue-500 relative group"
                      style={{
                        height: item.value > 0 ? `${(item.value / maxActivity) * 100}%` : '0%',
                        minHeight: item.value > 0 ? '8px' : '0px'
                      }}
                    >
                      {item.value > 0 && (
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                          {item.value}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-600">{item.day}</span>
                  </div>
                ))}
              </div>
              {!hasWeeklyActivity && (
                <p className="mt-3 text-xs text-gray-500">Chưa có hoạt động học trong 7 ngày gần đây.</p>
              )}
            </div>
          </div>

          <div className="xl:col-span-4">
            {activeExamGoal ? (
              <div className="h-full">
                <ExamCountdownTimer examGoal={activeExamGoal} />
              </div>
            ) : (
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg h-full">
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="text-4xl mb-3">📅</div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Count Down</h3>
                  <p className="text-sm text-gray-600">Set your exam goal to start countdown</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Kanji Review</h3>
            <p className="text-gray-600 text-xs sm:text-sm mb-4">
              {loading ? 'Loading...' : `${Math.max(0, 15 - stats.kanji_learned)} cards due`}
            </p>
            <button className="w-full bg-pink-100 text-pink-700 py-2 px-4 rounded-lg font-medium hover:bg-pink-200 transition-colors text-sm sm:text-base">
              Ready
            </button>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Vocabulary</h3>
            <p className="text-gray-600 text-xs sm:text-sm mb-4">
              {loading ? 'Loading...' : `${Math.max(0, 10 - stats.vocabulary_learned)} words to learn`}
            </p>
            <button className="w-full bg-blue-100 text-blue-700 py-2 px-4 rounded-lg font-medium hover:bg-blue-200 transition-colors text-sm sm:text-base">
              New
            </button>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Game</h3>
            <p className="text-gray-600 text-xs sm:text-sm mb-4">Challenge yourself</p>
            <button className="w-full bg-green-100 text-green-700 py-2 px-4 rounded-lg font-medium hover:bg-green-200 transition-colors text-sm sm:text-base">
              Play
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
