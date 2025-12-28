
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ChatConsolePage: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/console/ai-chat');
  }, [navigate]);

  return null;
};

export default ChatConsolePage;
