import { useContext } from 'react';
import { NavigationContext } from '../contexts/navigationContext';
import { Conversation } from '../types/conversation';
// Import the context directly to avoid circular dependency
import { MessageContext } from '../contexts/messageContext';

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }

  const { state, dispatch } = context;

  // Get the message context directly to avoid circular dependency
  const messageContext = useContext(MessageContext);
  
  // Handle the case where MessageContext is not available yet
  const setActiveConversation = messageContext?.setActiveConversation;
  const clearActiveConversation = messageContext?.clearActiveConversation;
  
  return {
    ...state,
    // Add activeConversation from MessageContext if available
    activeConversation: messageContext?.state.activeConversation || null,
    startNewConversation: () => {
      if (clearActiveConversation) {
        clearActiveConversation();
      }
      dispatch({ type: 'START_NEW_CONVERSATION' });
    },
    navigateToConversation: (conversation: Conversation) => {
      if (setActiveConversation) {
        setActiveConversation(conversation);
      }
      dispatch({ type: 'NAVIGATE_TO_CONVERSATION' });
    },
    navigateToMessages: () => dispatch({ type: 'NAVIGATE_TO_MESSAGES' }),
    openSettings: () => dispatch({ type: 'OPEN_SETTINGS' }),
    closeSettings: () => dispatch({ type: 'CLOSE_SETTINGS' }),
    reset: () => {
      if (clearActiveConversation) {
        clearActiveConversation();
      }
      dispatch({ type: 'RESET' });
    }
  };
}