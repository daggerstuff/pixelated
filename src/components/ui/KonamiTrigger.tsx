import { useKonamiCode } from '@/lib/hooks/useKonamiCode';

export const KonamiTrigger = () => {
  useKonamiCode(() => {
    window.location.href = '/egg';
  });

  return null; // This component renders nothing
};
