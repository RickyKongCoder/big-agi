import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, List } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { useChatLLM } from '~/modules/llms/store-llms';

import { createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ChatMessage } from './message/ChatMessage';
import { ChatMessageSelectable, MessagesSelectionHeader } from './message/ChatMessageSelectable';
import { PurposeSelector } from './purpose-selector/PurposeSelector';
import { SendModeId } from '../Chat';


/**
 * A list of ChatMessages
 */
export function ChatMessageList(props: {
  conversationId: string | null,
  messages: DMessage[],
  isMessageSelectionMode: boolean, setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  onExecuteConversation: (sendModeId: SendModeId, conversationId: string, history: DMessage[]) => void,
  onImagineFromText: (conversationId: string, userText: string) => void,
  sx?: SxProps
}) {
  // state
  const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());

  // external state
 

  const showSystemMessages = useUIPreferencesStore(state => state.showSystemMessages);

  const { editMessage, deleteMessage, historyTokenCount } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      messages: conversation ? conversation.messages : [],
      editMessage: state.editMessage, deleteMessage: state.deleteMessage,
      historyTokenCount: conversation ? conversation.tokenCount : 0,
    };
  }, shallow);
  const { chatLLM } = useChatLLM();

  const handleMessageDelete = (messageId: string) =>
    props.conversationId && deleteMessage(props.conversationId, messageId);

  const handleMessageEdit = (messageId: string, newText: string) =>
    props.conversationId && editMessage(props.conversationId, messageId, { text: newText }, true);

  const handleImagineFromText = (messageText: string) =>
    props.conversationId && props.onImagineFromText(props.conversationId, messageText);

  const handleRestartFromMessage = (messageId: string, offset: number) => {
    const truncatedHistory = props.messages.slice(0, props.messages.findIndex(m => m.id === messageId) + offset + 1);
    props.conversationId && props.onExecuteConversation('immediate', props.conversationId, truncatedHistory);
  };

  const handleRunExample = (text: string) =>
    props.conversationId && props.onExecuteConversation('immediate', props.conversationId, [...messages, createDMessage('user', text)]);


  // hide system messages if the user chooses so
  // NOTE: reverse is because we'll use flexDirection: 'column-reverse' to auto-snap-to-bottom
  const filteredMessages = props.messages.filter(m => m.role !== 'system' || true).reverse();

  // when there are no messages, show the purpose selector
  if (!filteredMessages.length)
    return props.conversationId ? (
      <Box sx={props.sx || {}}>
      </Box>
    ) : null;


  const handleToggleSelected = (messageId: string, selected: boolean) => {
    const newSelected = new Set(selectedMessages);
    selected ? newSelected.add(messageId) : newSelected.delete(messageId);
    setSelectedMessages(newSelected);
  };

  const handleSelectAllMessages = (selected: boolean) => {
    const newSelected = new Set<string>();
    if (selected)
      for (const message of props.messages)
        newSelected.add(message.id);
    setSelectedMessages(newSelected);
  };

  const handleDeleteSelectedMessages = () => {
    if (props.conversationId)
      for (const selectedMessage of selectedMessages)
        deleteMessage(props.conversationId, selectedMessage);
    setSelectedMessages(new Set());
  };


 
  return (
    <List sx={{
      p: 0, ...(props.sx || {}),
      // this makes sure that the the window is scrolled to the bottom (column-reverse)
      display: 'flex', flexDirection: 'column-reverse',
      // fix for the double-border on the last message (one by the composer, one to the bottom of the message)
      marginBottom: '-1px',
    }}>
      
      {filteredMessages.map((message, idx) =>
          <ChatMessage
            key={'msg-' + message.id} message={message}
            isBottom={idx === 0}
            onMessageDelete={() => handleMessageDelete(message.id)}
            onMessageEdit={newText => handleMessageEdit(message.id, newText)}
            onMessageRunFrom={(offset: number) => handleRestartFromMessage(message.id, offset)}
            onImagine={handleImagineFromText}
          />
      )}



    </List>
  );
}