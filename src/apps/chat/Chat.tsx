import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { useTheme } from '@mui/joy';

import { CmdRunProdia } from '~/modules/prodia/prodia.client';
import { CmdRunReact } from '~/modules/aifn/react/react';
import { PasteGG } from '~/modules/pastegg/pastegg.types';
import { PublishedModal } from '~/modules/pastegg/PublishedModal';
import { callPublish } from '~/modules/pastegg/pastegg.client';
import { imaginePromptFromText } from '~/modules/aifn/imagine/imaginePromptFromText';
import { useModelsStore } from '~/modules/llms/store-llms';

import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { Link } from '~/common/components/Link';
import { conversationToMarkdown } from '~/common/util/conversationToMarkdown';
import { createDMessage, DMessage, restoreConversationFromJson, useChatStore } from '~/common/state/store-chats';
import { extractCommands } from '~/common/util/extractCommands';
import { useApplicationBarStore } from '~/common/layouts/appbar/store-applicationbar';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ActionItems } from './components/appbar/ActionItems';
import { ChatMessageList } from './components/ChatMessageList';
import { Composer } from './components/composer/Composer';
import { ConversationItems } from './components/appbar/ConversationItems';
import { Dropdowns } from './components/appbar/Dropdowns';
import { Ephemerals } from './components/ephemerals/Ephemerals';
import { ImportedModal, ImportedOutcome } from './components/appbar/ImportedModal';
import { runAssistantUpdatingState } from './editors/chat-stream';
import { runImageGenerationUpdatingState } from './editors/image-generate';
import { runReActUpdatingState } from './editors/react-tangent';


const SPECIAL_ID_ALL_CHATS = 'all-chats';

export type SendModeId = 'immediate' | 'react';
// let messages:DMessage[] = 

export function Chat() {

  // state
  const [isMessageSelectionMode, setIsMessageSelectionMode] = React.useState(false);
  const [clearConfirmationId, setClearConfirmationId] = React.useState<string | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = React.useState<string | null>(null);
  const [publishConversationId, setPublishConversationId] = React.useState<string | null>(null);
  const [publishResponse, setPublishResponse] = React.useState<PasteGG.API.Publish.Response | null>(null);
  const [conversationImportOutcome, setConversationImportOutcome] = React.useState<ImportedOutcome | null>(null);
  const conversationFileInputRef = React.useRef<HTMLInputElement>(null);
  const [messages,setMessageList] = React.useState([
    {
      id: "01",
      text: "Hello world",
      sender: 'You',
    },
    {
      id:"02",
      text: "Hello world2",
      sender: 'You',
    },{
      id:"03",
      text: "ass",
      sender:'bot'
      
    }
  ]);
  // external state
  const theme = useTheme();
  const { activeConversationId, isConversationEmpty, conversationsCount, importConversation, deleteAllConversations, setMessages, systemPurposeId, setAutoTitle } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === state.activeConversationId);
    return {
      activeConversationId: state.activeConversationId,
      isConversationEmpty: conversation ? !conversation.messages.length : true,
      conversationsCount: state.conversations.length,
      importConversation: state.importConversation,
      deleteAllConversations: state.deleteAllConversations,
      setMessages: state.setMessages,
      systemPurposeId: conversation?.systemPurposeId ?? null,
      setAutoTitle: state.setAutoTitle,
    };
  }, shallow);


  const handleExecuteConversation = async (sendModeId: SendModeId, conversationId: string, history: DMessage[]) => {
    const { chatLLMId } = useModelsStore.getState();
    console.log("handleClearConversation")

    console.log(sendModeId)

    if (!conversationId || !chatLLMId) return;
    // Command - last user message is a cmd
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;
    if (lastMessage?.role === 'user') {
      console.log("user message")
    }
    
  };

  const _findConversation = (conversationId: string) =>
    conversationId ? useChatStore.getState().conversations.find(c => c.id === conversationId) ?? null : null;

  const handleSendUserMessage = async (sendModeId: SendModeId, conversationId: string, userText: string) => {
    const conversation = _findConversation(conversationId);
    console.log("handle send user message",conversationId,messages,userText)
    setMessageList([... messages,{
      id: messages.length.toString(),
      text: userText,
      sender:'You'
    }]); 
    console.log("Messages List",messages)
      
  
  };

  const handleImagineFromText = async (conversationId: string, messageText: string) => {
    const conversation = _findConversation(conversationId);
    if (conversation) {
      const prompt = await imaginePromptFromText(messageText);
      if (prompt)
        return await handleExecuteConversation('immediate', conversationId, [...conversation.messages, createDMessage('user', `${CmdRunProdia[0]} ${prompt}`)]);
    }
  
  };


  const handleClearConversation = (conversationId: string) => setClearConfirmationId(conversationId);

  const handleConfirmedClearConversation = () => {
    if (clearConfirmationId) {
      setMessages(clearConfirmationId, []);
      setAutoTitle(clearConfirmationId, '');
      setClearConfirmationId(null);
    }
  };

  const handleDeleteAllConversations = () => setDeleteConfirmationId(SPECIAL_ID_ALL_CHATS);

  const handleConfirmedDeleteConversation = () => {
    if (deleteConfirmationId) {
      if (deleteConfirmationId === SPECIAL_ID_ALL_CHATS) {
        deleteAllConversations();
      }// else
      //  deleteConversation(deleteConfirmationId);
      setDeleteConfirmationId(null);
    }
  };

  const handlePublishConversation = (conversationId: string) => setPublishConversationId(conversationId);

  const handleConfirmedPublishConversation = async () => {
    if (publishConversationId) {
      const conversation = _findConversation(publishConversationId);
      setPublishConversationId(null);
      if (conversation) {
        const markdownContent = conversationToMarkdown(conversation, !useUIPreferencesStore.getState().showSystemMessages);
        const publishResponse = await callPublish('paste.gg', markdownContent);
        setPublishResponse(publishResponse);
      }
    }
  };

  const handleImportConversation = () => conversationFileInputRef.current?.click();

  const handleImportConversationFromFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (!files || files.length < 1)
      return;

    // try to restore conversations from the selected files
    const outcomes: ImportedOutcome = { conversations: [] };
    for (const file of files) {
      const fileName = file.name || 'unknown file';
      try {
        const conversation = restoreConversationFromJson(await file.text());
        if (conversation) {
          importConversation(conversation);
          outcomes.conversations.push({ fileName, success: true, conversationId: conversation.id });
        } else {
          const fileDesc = `(${file.type}) ${file.size.toLocaleString()} bytes`;
          outcomes.conversations.push({ fileName, success: false, error: `Invalid file: ${fileDesc}` });
        }
      } catch (error) {
        console.error(error);
        outcomes.conversations.push({ fileName, success: false, error: (error as any)?.message || error?.toString() || 'unknown error' });
      }
    }

    // show the outcome of the import
    setConversationImportOutcome(outcomes);

    // this is needed to allow the same file to be selected again
    e.target.value = '';
  };


  // Pluggable ApplicationBar components

  const dropdowns = React.useMemo(() =>
      <Dropdowns conversationId={activeConversationId} />,
    [activeConversationId],
  );

  const conversationsBadge = conversationsCount < 2 ? 0 : conversationsCount;

  const conversationItems = React.useMemo(() =>
      <ConversationItems
        conversationId={activeConversationId}
        onImportConversation={handleImportConversation}
        onDeleteAllConversations={handleDeleteAllConversations}
      />,
    [activeConversationId],
  );

  const actionItems = React.useMemo(() =>
      <ActionItems
        conversationId={activeConversationId} isConversationEmpty={isConversationEmpty}
        isMessageSelectionMode={isMessageSelectionMode} setIsMessageSelectionMode={setIsMessageSelectionMode}
        onClearConversation={handleClearConversation}
        onPublishConversation={handlePublishConversation}
      />,
    [activeConversationId, isConversationEmpty, isMessageSelectionMode],
  );

  React.useEffect(() => {
    useApplicationBarStore.getState().register(dropdowns, conversationsBadge, conversationItems, actionItems);
    return () => useApplicationBarStore.getState().unregister();
  }, [dropdowns, conversationsBadge, conversationItems, actionItems]);

  return <>

    <ChatMessageList
      conversationId={activeConversationId}
      isMessageSelectionMode={isMessageSelectionMode} setIsMessageSelectionMode={setIsMessageSelectionMode}
      onExecuteConversation={handleExecuteConversation}
      onImagineFromText={handleImagineFromText}
      messages = {messages}
      sx={{
        flexGrow: 1,
        background: theme.vars.palette.background.level2,
        overflowY: 'auto', // overflowY: 'hidden'
        minHeight: 96,
        maxWidth:"50%"
      }} />

    <Ephemerals
      conversationId={activeConversationId}
      sx={{
        // flexGrow: 0.1,
        flexShrink: 0.5,
        overflowY: 'auto',
        minHeight: 64,
      }} />


    <Composer
      conversationId={activeConversationId} messageId={null}
      isDeveloperMode={systemPurposeId === 'Developer'}
      onSendMessage={handleSendUserMessage}
      sx={{
        zIndex: 21, // position: 'sticky', bottom: 0,
        background: theme.vars.palette.background.surface,
        borderTop: `1px solid ${theme.vars.palette.divider}`,
        p: { xs: 1, md: 2 },
      }} />


    {/* Import Chat */}
    <input type='file' multiple hidden accept='.json' ref={conversationFileInputRef} onChange={handleImportConversationFromFiles} />
    {!!conversationImportOutcome && (
      <ImportedModal open outcome={conversationImportOutcome} onClose={() => setConversationImportOutcome(null)} />
    )}

    {/* Clear */}
    <ConfirmationModal
      open={!!clearConfirmationId} onClose={() => setClearConfirmationId(null)} onPositive={handleConfirmedClearConversation}
      confirmationText={'Are you sure you want to discard all the messages?'} positiveActionText={'Clear conversation'}
    />

    {/* Deletion */}
    <ConfirmationModal
      open={!!deleteConfirmationId} onClose={() => setDeleteConfirmationId(null)} onPositive={handleConfirmedDeleteConversation}
      confirmationText={deleteConfirmationId === SPECIAL_ID_ALL_CHATS
        ? 'Are you absolutely sure you want to delete ALL conversations? This action cannot be undone.'
        : 'Are you sure you want to delete this conversation?'}
      positiveActionText={deleteConfirmationId === SPECIAL_ID_ALL_CHATS
        ? 'Yes, delete all'
        : 'Delete conversation'}
    />

    {/* Publishing */}
    <ConfirmationModal
      open={!!publishConversationId} onClose={() => setPublishConversationId(null)} onPositive={handleConfirmedPublishConversation}
      confirmationText={<>
        Share your conversation anonymously on <Link href='https://paste.gg' target='_blank'>paste.gg</Link>?
        It will be unlisted and available to share and read for 30 days. Keep in mind, deletion may not be possible.
        Are you sure you want to proceed?
      </>} positiveActionText={'Understood, upload to paste.gg'}
    />
    {!!publishResponse && (
      <PublishedModal open onClose={() => setPublishResponse(null)} response={publishResponse} />
    )}

  </>;
}
