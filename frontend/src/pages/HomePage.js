import React from 'react';
import Home from '../components/Home';

const HomePage = ({ activeExamGoal, authToken }) => (
  <Home activeExamGoal={activeExamGoal} authToken={authToken} />
);

export default HomePage;
