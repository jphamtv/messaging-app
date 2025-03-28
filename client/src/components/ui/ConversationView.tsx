import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigation } from '../../hooks/useNavigation';
import { useMessaging } from '../../hooks/useMessaging';
import { useSocket } from '../../hooks/useSocket';
import NewConversationHeader from './NewConversationHeader';
import Button from './Button';
import ProfileInfo from './ProfileInfo';
import Modal from './Modal';
import BotBadge from './BotBadge';
import { Trash2, ChevronDown, X } from 'lucide-react';
import MenuButton from './MenuButton';
import styles from './ConversationView.module.css';
import { User } from '../../types/user';
import { Conversation } from '../../types/conversation';
import { logger } from '../../utils/logger';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

interface Props {
  conversation?: Conversation;
}

export default function ConversationView({ conversation }: Props) {
  const { user } = useAuth();
  const { messages, sendMessage, sendMessageWithImage, loadMessages, clearMessages, createConversation, deleteConversation, markConversationAsRead, isCreatingConversation } = useMessaging();
  const { isNewConversation, navigateToConversation } = useNavigation();
  const { handleTyping, getTypingUsers } = useSocket();

  const [showProfileInfo, setShowProfileInfo] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isSendingImage, setIsSendingImage] = useState<boolean>(false);
  const [profileInfoPosition, setProfileInfoPosition] = useState<{ top: number, left: number }>({ top: 0, left: 0 });
  const [sendError, setSendError] = useState<string | null>(null);
  
  const profileInfoRef = useRef<HTMLDivElement>(null);
  const displayProfileLinkRef = useRef<HTMLAnchorElement>(null);

  // Memoize typing users from the current conversation
  const typingUsers = useMemo(() => {
    if (!conversation) return [];
    return getTypingUsers(conversation.id);
  }, [conversation, getTypingUsers]);

  // Memoize filtered typing users (excluding current user)
  const otherTypingUsers = useMemo(() => {
    return typingUsers.filter(id => id !== user?.id);
  }, [typingUsers, user?.id]);

  // Memoize active recipient
  const activeRecipient = useMemo(() => {
    if (!conversation) return null;
    return conversation.participants.find(p => p.userId !== user?.id)?.user;
  }, [conversation, user?.id]);

  // Memoize typing username
  const typingUserName = useMemo(() => {
    if (otherTypingUsers.length === 0 || !activeRecipient) return '';
    return activeRecipient.profile.displayName || activeRecipient.username;
  }, [otherTypingUsers, activeRecipient]);

  // Check to determine if the current conversation is with a bot
  const isConversationWithBot = activeRecipient?.isBot || false;
 
  useEffect(() => {
    if (isNewConversation) {
      clearMessages();
    } else if (conversation) {
      loadMessages(conversation.id);
    }
  }, [conversation, isNewConversation, loadMessages, clearMessages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileInfoRef.current &&
        !profileInfoRef.current.contains(event.target as Node) &&
        !displayProfileLinkRef.current?.contains(event.target as Node)
      ) {
        setShowProfileInfo(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (conversation && !isNewConversation) {
      // Mark as read when user views the conversation
      markConversationAsRead(conversation.id);
      loadMessages(conversation.id);
    }
  }, [conversation, isNewConversation, markConversationAsRead, loadMessages]);

  // Automatically clear errors after 5 seconds
  useEffect(() => {
    if (sendError) {
      const timer = setTimeout(() => {
        setSendError(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [sendError]);

  const handleUserSelect = async (selected: User) => {
    if (isCreatingConversation) return;
    
    try {
      const newConversation = await createConversation(selected.id);
      navigateToConversation(newConversation);
    } catch (error) {
      logger.error('Failed to create conversation:', error);
    }
  };

  const handleSendMessage = async (text: string, file: File | null) => {
    if ((!text.trim() && !file) || !conversation) {
      return;
    }

    setSendError(null);

    try {
      if (file) {
        setIsSendingImage(true);
        const formData = new FormData();
        formData.append('image', file);
        if (text.trim()) {
          formData.append('text', text.trim());
        }
        await sendMessageWithImage(conversation.id, formData);
      } else {
        await sendMessage(conversation.id, text.trim());
      }

      // Stop typing indicator when message is sent
      if (conversation) {
        handleTyping(conversation.id, false);
      }

    } catch (err) {
      logger.error('Failed to send message:', err);

      // Set user-friendly error message
      const errorMessage = err instanceof Error ?
        err.message : 'Failed to send message. Please try again.';
      setSendError(errorMessage);
      throw err;
    } finally {
      setIsSendingImage(false);
    }
  };

  const handleInfoClick = () => {
    // Get the position of the link that was clicked
    if (displayProfileLinkRef.current) {
      const rect = displayProfileLinkRef.current.getBoundingClientRect();
      // Position just below the name with a small offset for the triangle
      setProfileInfoPosition({
        top: rect.bottom + window.scrollY + 8, // Add extra space for the triangle
        left: Math.max(rect.left + window.scrollX - 20, 10) // Offset so triangle points to middle of name
      });
    }
    setShowProfileInfo(prev => !prev);
  };
  
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!conversation) return;

    try {
      await deleteConversation(conversation.id);
      setShowDeleteModal(false);
    } catch (err) {
      logger.error('Failed to delete conversation:', err);
    }
  };

  const handleTypingIndicator = (isTyping: boolean) => {
    if (!conversation) return;

    handleTyping(conversation.id, isTyping);
  };

  return (
    <div className={styles.container} role="main" aria-label="Conversation view">
      <div className={styles.headerContainer}>
        {/* Mobile menu button */}
        <div className={styles.mobileMenuContainer}>
          <MenuButton />
        </div>
        
        <div className={styles.label}>
          To:
        </div>
        
        {isNewConversation ? (
          <div className={styles.headerContent}>
            <NewConversationHeader 
              onUserSelect={handleUserSelect} 
              disabled={isCreatingConversation || false}
            />
          </div>
        ) : (
          <div className={styles.headerContent}>
          <div className={styles.activeConversationHeader}>
          {conversation && (
          <a 
          ref={displayProfileLinkRef} 
          onClick={handleInfoClick} 
          className={styles.profileLink}
          role="button"
          tabIndex={0}
          aria-label={`View profile for ${activeRecipient?.profile.displayName || activeRecipient?.username || 'Unknown User'}${activeRecipient?.isBot ? ' (AI)' : ''}`}
          aria-expanded={showProfileInfo}
            onKeyDown={(e) => e.key === 'Enter' && handleInfoClick()}
            >
                    <div className={styles.recipientName}>
                      {activeRecipient?.profile.displayName || 
                      activeRecipient?.username || 
                      'Unknown User'}
                      {activeRecipient?.isBot && <BotBadge />}
                    </div>
                    <ChevronDown size={16} className={styles.chevronIcon} strokeWidth={1}/>
                  </a>
                )}
              <div className={styles.actions}>
                <button 
                  onClick={handleDeleteClick}
                  aria-label="Delete conversation"
                >
                  <Trash2 size={20} strokeWidth={1} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {showProfileInfo && activeRecipient && (
        <div 
          ref={profileInfoRef} 
          className={styles.profileInfoContainer}
          style={{
            position: 'absolute',
            top: `${profileInfoPosition.top}px`,
            left: `${profileInfoPosition.left}px`,
          }}
        >
          <ProfileInfo recipient={activeRecipient} />
        </div>
      )}

      <MessageList
        messages={messages}
        currentUserId={user?.id}
        typingUserName={typingUserName}
        isTyping={otherTypingUsers.length > 0}
        isConversationWithBot={isConversationWithBot}
      />

      {sendError && (
        <div className={styles.errorMessage}>
          <p>{sendError}</p>
          <button 
            className={styles.dismissButton}
            onClick={() => setSendError(null)}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <MessageInput
        conversationId={conversation?.id}
        onSendMessage={handleSendMessage}
        isDisabled={isNewConversation || isCreatingConversation}
        isSending={isSendingImage}
        isConversationWithBot={isConversationWithBot}
        onTyping={handleTypingIndicator}
      />

      {showDeleteModal && conversation && (
        <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} hideCloseButton>
          <div className={styles.confirmationModal}>
            <h3 id="modal-title">Delete Conversation</h3>
            <p>Are you sure you want to delete this conversation? This action cannot be undone.</p>
            <div className={styles.modalActions}>
              <Button
                onClick={() => setShowDeleteModal(false)}
                variant="secondary"
                tabIndex={0}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                variant="danger"
                tabIndex={0}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}