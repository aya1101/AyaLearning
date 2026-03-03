import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch game data from API
 * @param {string} gameType - Type of game (shiritori, karuta, fukuwarai)
 * @param {string} difficulty - Difficulty level (N5, N4, N3, etc.)
 * @param {number} limit - Number of items to fetch
 * @param {string} token - JWT token for authentication
 */
export const useGameData = (gameType, difficulty = 'N5', limit = 50, token) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameType || !token) {
      setLoading(false);
      return;
    }

    const fetchGameData = async () => {
      try {
        setLoading(true);
        setError(null);

        const queryParams = new URLSearchParams({
          difficulty,
          limit
        });

        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/games/${gameType}/words?${queryParams}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch game data: ${response.status}`);
        }

        const result = await response.json();
        setData(result.words || []);
      } catch (err) {
        console.error('Error fetching game data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [gameType, difficulty, limit, token]);

  return { data, loading, error };
};

/**
 * Custom hook to save game results
 * @param {string} token - JWT token for authentication
 */
export const useGameResults = (token) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const saveResult = async (gameResult) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/game-results`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gameResult)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save game result: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error('Error saving game result:', err);
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return { saveResult, saving, error };
};
