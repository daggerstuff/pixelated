import { useState, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { authClient } from "@/lib/auth-client";
import { consentService } from "@/lib/security/consent/ConsentService";
import type { UserConsentStatus } from "@/lib/security/consent/types";

/**
 * Hook to manage the state of research consent including data fetching and selection
 */
function useConsentState(user: { id: string } | undefined) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consentStatus, setConsentStatus] = useState<UserConsentStatus | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    const fetchConsentStatus = async () => {
      if (!user) {
        if (active) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const statuses = await consentService.getUserConsentStatus({
          userId: user.id,
          consentTypeName: "Research Participation",
        });

        if (!active) return;

        if (statuses.length > 0) {
          const status = statuses[0] || null;
          setConsentStatus(status);

          // Initialize selected options from user's existing consent if available
          if (status?.userConsent?.granularOptions) {
            setSelectedOptions(status.userConsent.granularOptions);
          } else if (status) {
            // Otherwise initialize with default values
            const initialOptions: Record<string, boolean> = {};
            status.consentOptions?.forEach((option) => {
              initialOptions[option.optionName] = option.defaultValue;
            });
            setSelectedOptions(initialOptions);
          }
        }
      } catch (err: unknown) {
        if (active) {
          console.error("Error fetching consent status:", err);
          setError("Failed to load consent information. Please try again later.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchConsentStatus();
    return () => {
      active = false;
    };
  }, [user]);

  return {
    loading,
    setLoading,
    error,
    setError,
    consentStatus,
    setConsentStatus,
    selectedOptions,
    setSelectedOptions,
  };
}

/**
 * Hook to manage research consent mutations (grant, withdraw, change options)
 */
function useConsentActions(
  user: { id: string } | undefined,
  consentStatus: UserConsentStatus | null,
  selectedOptions: Record<string, boolean>,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  setConsentStatus: (status: UserConsentStatus | null) => void,
  setSelectedOptions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  const refreshConsentStatus = async () => {
    if (!user) return;
    const statuses = await consentService.getUserConsentStatus({
      userId: user.id,
      consentTypeName: "Research Participation",
    });
    if (statuses.length > 0) {
      setConsentStatus(statuses[0] || null);
    }
  };

  const handleGrantConsent = async () => {
    if (!user || !consentStatus) return false;

    try {
      setLoading(true);
      setError(null);
      const { userAgent } = window.navigator;

      await consentService.grantConsent({
        userId: user.id,
        consentVersionId: consentStatus.currentVersion.id,
        userAgent,
        granularOptions: selectedOptions,
      });

      await refreshConsentStatus();
      return true;
    } catch (err: unknown) {
      console.error("Error granting consent:", err);
      setError("Failed to record your consent. Please try again later.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawConsent = async (withdrawReason: string) => {
    if (!user || !consentStatus?.userConsent) return false;

    try {
      setLoading(true);
      setError(null);
      const { userAgent } = window.navigator;

      await consentService.withdrawConsent({
        userId: user.id,
        consentId: consentStatus.userConsent.id,
        reason: withdrawReason,
        userAgent,
      });

      await refreshConsentStatus();
      return true;
    } catch (err: unknown) {
      console.error("Error withdrawing consent:", err);
      setError("Failed to withdraw your consent. Please try again later.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (optionName: string, checked: boolean) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionName]: checked,
    }));
  };

  return {
    handleGrantConsent,
    handleWithdrawConsent,
    handleOptionChange,
  };
}

export function useResearchConsent() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const {
    loading,
    setLoading,
    error,
    setError,
    consentStatus,
    setConsentStatus,
    selectedOptions,
    setSelectedOptions,
  } = useConsentState(user);

  const {
    handleGrantConsent,
    handleWithdrawConsent,
    handleOptionChange,
  } = useConsentActions(
    user,
    consentStatus,
    selectedOptions,
    setLoading,
    setError,
    setConsentStatus,
    setSelectedOptions,
  );

  // Check if all required options are selected
  const allRequiredOptionsSelected = () => {
    if (!consentStatus?.consentOptions) {
      return true;
    }

    return consentStatus.consentOptions
      .filter((option) => option.isRequired)
      .every((option) => selectedOptions[option.optionName]);
  };

  // Memoize sanitized document text
  const sanitizedDocumentText = useMemo(() => {
    if (!consentStatus?.currentVersion?.documentText) return "";
    return DOMPurify.sanitize(consentStatus.currentVersion.documentText);
  }, [consentStatus?.currentVersion?.documentText]);

  return {
    loading,
    error,
    consentStatus,
    selectedOptions,
    handleGrantConsent,
    handleWithdrawConsent,
    handleOptionChange,
    allRequiredOptionsSelected,
    sanitizedDocumentText,
  };
}
