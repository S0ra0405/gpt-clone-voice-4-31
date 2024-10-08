import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from "@/components/ui/use-toast"
import { scoreResponse } from '@/utils/scoreUtils';

export const useChatLogic = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [systemMessage, setSystemMessage] = useState(() => localStorage.getItem('system_message') || 'You are a helpful assistant.');
  const [conversations, setConversations] = useState(() => {
    const savedConversations = localStorage.getItem('conversations');
    return savedConversations ? JSON.parse(savedConversations) : [];
  });
  const [currentConversationIndex, setCurrentConversationIndex] = useState(0);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [score, setScore] = useState(50);
  const [lastScoreChange, setLastScoreChange] = useState(0);
  const [lastFeedback, setLastFeedback] = useState('');
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [pdfContent, setPdfContent] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  const startNewConversation = (role = null) => {
    const newConversation = {
      title: role ? `New ${role.name} Conversation` : 'New Conversation',
      messages: [],
      role: role
    };
    setConversations(prevConversations => [...prevConversations, newConversation]);
    setCurrentConversationIndex(conversations.length);
    setInput('');
    setCurrentPromptIndex(0);
    if (role) {
      setSelectedRole(role);
      setSystemMessage(role.systemMessage);
    }
  };

  const switchConversation = (index) => {
    setCurrentConversationIndex(index);
    setInput('');
    const selectedConversation = conversations[index];
    if (selectedConversation.role) {
      setSelectedRole(selectedConversation.role);
      setSystemMessage(selectedConversation.role.systemMessage);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const handlePDFLoaded = (content) => {
    setPdfContent(content);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !apiKey) return;

    const userMessage = { role: 'user', content: input };
    setConversations(prevConversations => {
      const updatedConversations = [...prevConversations];
      updatedConversations[currentConversationIndex].messages.push(userMessage);
      return updatedConversations;
    });
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: selectedRole ? selectedRole.systemMessage : systemMessage },
            ...conversations[currentConversationIndex].messages,
            userMessage
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response from OpenAI');
      }

      const data = await response.json();
      const assistantMessage = { role: 'assistant', content: data.choices[0].message.content };

      setConversations(prevConversations => {
        const updatedConversations = [...prevConversations];
        updatedConversations[currentConversationIndex].messages.push(assistantMessage);
        return updatedConversations;
      });

      const { scoreChange, feedback } = scoreResponse(userMessage.content, assistantMessage.content);
      setScore(prevScore => {
        const newScore = Math.max(0, Math.min(100, prevScore + scoreChange));
        return newScore;
      });
      setLastScoreChange(scoreChange);
      setLastFeedback(feedback);

      if (conversations[currentConversationIndex].messages.length === 0) {
        const titleResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'Generate a short title (max 6 words) for this conversation based on the first message.' },
              userMessage
            ]
          })
        });

        if (titleResponse.ok) {
          const titleData = await titleResponse.json();
          const title = titleData.choices[0].message.content.trim();
          setConversations(prevConversations => {
            const updatedConversations = [...prevConversations];
            updatedConversations[currentConversationIndex].title = title;
            return updatedConversations;
          });
        }
      }

      if (selectedRole && selectedRole.assistantPrompts.length > 0) {
        setCurrentPromptIndex((prevIndex) => (prevIndex + 1) % selectedRole.assistantPrompts.length);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch response. Please check your API key and try again.",
        variant: "destructive",
      });
      setConversations(prevConversations => {
        const updatedConversations = [...prevConversations];
        updatedConversations[currentConversationIndex].messages.push({ role: 'assistant', content: 'Error: Unable to fetch response' });
        return updatedConversations;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return {
    apiKey,
    setApiKey,
    systemMessage,
    setSystemMessage,
    conversations,
    currentConversationIndex,
    input,
    setInput,
    isStreaming,
    isSidebarOpen,
    searchQuery,
    setSearchQuery,
    selectedRole,
    setSelectedRole,
    score,
    lastScoreChange,
    lastFeedback,
    startNewConversation,
    switchConversation,
    toggleSidebar,
    handleSubmit,
    currentPromptIndex,
    handlePDFLoaded
  };
};