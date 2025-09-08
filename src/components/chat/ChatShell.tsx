// ChatShell: centralizes scroll management & positions, wraps chat UI (container/input/messages).
import React, { useRef, useEffect, useCallback, useState } from 'react';

interface ChatShellProps {
  children: (scrollApi: {
    scrollToBottom: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    showScrollButton: boolean;
  }) => React.ReactNode;
  autoScrollDeps: unknown[]; // e.g. [messages, isTyping]
}

export function ChatShell({ children, autoScrollDeps }: ChatShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Scroll to bottom when new messages etc.
  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...autoScrollDeps, scrollToBottom]);

  // Toggle scroll-to-bottom button on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {children({
        scrollToBottom,
        containerRef,
        messagesEndRef,
        showScrollButton,
      })}
    </div>
  );
}