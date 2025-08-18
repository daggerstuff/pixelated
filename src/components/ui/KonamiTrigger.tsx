import React from 'react';
import { useKonamiCode } from '@/lib/hooks/useKonamiCode';

export const KonamiTrigger: FC = () => {
  useKonamiCode(() => {
    window.location.href = '/egg';
  });

  return null; // This component renders nothing
};
