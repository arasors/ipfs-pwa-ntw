import { useState, useRef, KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';

// Material UI imports
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

// Material Icons
import SendIcon from '@mui/icons-material/Send';

import { useUserStore } from '../store/userStore';
import { useMessageStore } from '../store/messageStore';

type ChatInputProps = {
  chatId: string;
  recipientAddress: string;
};

type FormValues = {
  message: string;
};

export function ChatInput({ chatId, recipientAddress }: ChatInputProps) {
  const userStore = useUserStore();
  const { sendMessage } = useMessageStore();
  const [isSending, setIsSending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<FormValues>({
    defaultValues: {
      message: '',
    },
  });

  const handleSubmit = async (values: FormValues) => {
    const user = userStore.users?.[0]; // Adapt this to your actual store structure
    
    if (!values.message.trim() || !user || isSending) {
      return;
    }

    try {
      setIsSending(true);
      
      // Send the message with required properties only
      await sendMessage({
        chatId,
        content: values.message.trim(),
      });

      form.reset();
      
      // Focus the input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.handleSubmit(handleSubmit)();
    }
  };

  return (
    <Box sx={{ 
      borderTop: 1, 
      borderColor: 'divider', 
      p: 1.5 
    }}>
      <form 
        ref={formRef} 
        onSubmit={form.handleSubmit(handleSubmit)} 
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <TextField
          {...form.register('message')}
          inputRef={inputRef}
          placeholder="Type a message..."
          variant="outlined"
          size="small"
          fullWidth
          disabled={isSending}
          onKeyDown={handleKeyDown}
          sx={{ flex: 1 }}
        />
        <Button 
          type="submit" 
          variant="contained" 
          disabled={isSending}
          sx={{ minWidth: 40, width: 40, height: 40, p: 0 }}
        >
          <SendIcon fontSize="small" />
        </Button>
      </form>
    </Box>
  );
} 