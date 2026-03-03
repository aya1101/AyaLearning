import React, { useState } from 'react';
import CharacterSelection from '../components/CharacterSelection';
import KaiwaChat from '../components/KaiwaChat';

const KaiwaPage = ({ token }) => {
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  if (selectedCharacter) {
    return (
      <KaiwaChat
        character={selectedCharacter}
        token={token}
        onBack={() => setSelectedCharacter(null)}
      />
    );
  }

  return (
    <CharacterSelection 
      token={token} 
      onCharacterSelect={setSelectedCharacter} 
    />
  );
};

export default KaiwaPage;
