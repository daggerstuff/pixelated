import { Button } from '@/components/ui/button/index'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * Form Style Guide Component — Neutral Precision
 *
 * Displays standardized form inputs styled with the NP design system
 * to serve as a reference for consistent form styling across the application.
 */
export function FormStyleGuide() {
  return (
    <div className="np-fsg">
      <style>{`
        .np-fsg {
          display: flex;
          flex-direction: column;
          gap: var(--np-space-8, 2rem);
          font-family: var(--np-font-body, 'Inter', system-ui, sans-serif);
          color: var(--np-text, #ededed);
        }
        .np-fsg__group {
          display: flex;
          flex-direction: column;
          gap: var(--np-space-4, 1rem);
        }
        .np-fsg__group-header {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .np-fsg__group-title {
          font-family: var(--np-font-mono, 'IoskeleyMono', monospace);
          font-size: var(--np-text-label, 0.75rem);
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--np-mid, #b3b3b3);
        }
        .np-fsg__group-desc {
          font-size: var(--np-text-small, 0.875rem);
          color: var(--np-muted, #8c8c8c);
          line-height: 1.5;
        }
        .np-fsg__grid {
          display: grid;
          gap: var(--np-space-4, 1rem);
          grid-template-columns: repeat(2, 1fr);
        }
        .np-fsg__field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .np-fsg__grid--1 {
          grid-column: 1 / -1;
        }

        /* NP-styled labels */
        .np-fsg .np-fsg__label {
          font-family: var(--np-font-mono, 'IoskeleyMono', monospace) !important;
          font-size: var(--np-text-label, 0.75rem) !important;
          font-weight: 500 !important;
          letter-spacing: 0.04em !important;
          text-transform: uppercase !important;
          color: var(--np-mid, #b3b3b3) !important;
          line-height: 1.3 !important;
        }

        /* NP-styled inputs */
        .np-fsg input[type='text'],
        .np-fsg input[type='email'],
        .np-fsg input[type='password'],
        .np-fsg input[type='number'],
        .np-fsg input[type='date'],
        .np-fsg input:not([type]),
        .np-fsg textarea {
          border-radius: 0 !important;
          border: 1px solid var(--np-line-strong, rgba(255,255,255,0.12)) !important;
          background: var(--np-bg, #1a1a1a) !important;
          color: var(--np-text, #ededed) !important;
          font-family: var(--np-font-mono, 'IoskeleyMono', monospace) !important;
          font-size: var(--np-text-small, 0.875rem) !important;
          box-shadow: none !important;
          transition: border-color var(--np-duration-fast, 0.15s) ease-out !important;
        }
        .np-fsg input:focus-visible,
        .np-fsg textarea:focus-visible {
          border-color: var(--np-text, #ededed) !important;
          outline: none !important;
          box-shadow: none !important;
          ring: 0 !important;
          --tw-ring-color: transparent !important;
          --tw-ring-shadow: 0 0 0 0 transparent !important;
        }
        .np-fsg input::placeholder,
        .np-fsg textarea::placeholder {
          color: var(--np-muted, #8c8c8c) !important;
          font-family: var(--np-font-mono, 'IoskeleyMono', monospace) !important;
        }
        .np-fsg input:disabled,
        .np-fsg textarea:disabled {
          opacity: 0.45 !important;
          cursor: not-allowed !important;
        }
        .np-fsg input[aria-invalid='true'],
        .np-fsg input.border-destructive {
          border-color: var(--np-text, #ededed) !important;
          background: var(--np-surface, #242424) !important;
        }
        .np-fsg .np-fsg__error-text {
          font-family: var(--np-font-mono, 'IoskeleyMono', monospace);
          font-size: var(--np-text-caption, 0.6875rem);
          color: var(--np-text, #ededed);
          text-transform: lowercase;
        }

        /* Inputs in the size variants */
        .np-fsg input.h-8 {
          padding: 0.25rem 0.5rem !important;
          font-size: 0.75rem !important;
        }
        .np-fsg input.h-12 {
          padding: 0.75rem 1rem !important;
          font-size: 1rem !important;
        }

        /* NP-styled buttons */
        .np-fsg button,
        .np-fsg a[role='button'] {
          border-radius: 0 !important;
          border: 1px solid var(--np-text, #ededed) !important;
          background: var(--np-text, #ededed) !important;
          color: var(--np-bg, #1a1a1a) !important;
          font-family: var(--np-font-mono, 'IoskeleyMono', monospace) !important;
          font-size: var(--np-text-label, 0.75rem) !important;
          font-weight: 600 !important;
          letter-spacing: 0.04em !important;
          text-transform: uppercase !important;
          padding: 0.5rem 1.1rem !important;
          min-height: 2.5rem !important;
          box-shadow: none !important;
          transition: background var(--np-duration-fast, 0.15s) ease-out,
                      color var(--np-duration-fast, 0.15s) ease-out !important;
        }
        .np-fsg button:hover,
        .np-fsg a[role='button']:hover {
          background: var(--np-bg, #1a1a1a) !important;
          color: var(--np-text, #ededed) !important;
          transform: none !important;
        }
        .np-fsg button:disabled {
          opacity: 0.45 !important;
          cursor: not-allowed !important;
        }
        /* Outline/ghost variant */
        .np-fsg .np-fsg__btn-ghost {
          background: transparent !important;
          color: var(--np-mid, #b3b3b3) !important;
          border-color: var(--np-line-strong, rgba(255,255,255,0.12)) !important;
        }
        .np-fsg .np-fsg__btn-ghost:hover {
          border-color: var(--np-text, #ededed) !important;
          color: var(--np-text, #ededed) !important;
          background: transparent !important;
        }

        /* Form example */
        .np-fsg__form-example {
          border: 1px solid var(--np-line-strong, rgba(255,255,255,0.12));
          padding: var(--np-space-4, 1rem);
          background: var(--np-bg, #1a1a1a);
          border-radius: 0;
        }
        .np-fsg__form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        /* Icon input wrapper */
        .np-fsg__icon-wrap {
          position: relative;
        }
        .np-fsg__icon-wrap svg {
          color: var(--np-muted, #8c8c8c) !important;
        }

        @media (max-width: 640px) {
          .np-fsg__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="np-fsg__group">
        <div className="np-fsg__group-header">
          <span className="np-fsg__group-title">Text inputs</span>
          <span className="np-fsg__group-desc">
            Standard text inputs for collecting user information.
          </span>
        </div>
        <div className="np-fsg__grid">
          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="default-input">
              Default input
            </Label>
            <Input id="default-input" placeholder="enter your name" />
          </div>

          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="disabled-input">
              Disabled input
            </Label>
            <Input
              id="disabled-input"
              placeholder="this input is disabled"
              disabled
            />
          </div>

          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="error-input">
              Input with error
            </Label>
            <Input id="error-input" placeholder="invalid input" error aria-describedby="error-input-msg" />
            <p id="error-input-msg" className="np-fsg__error-text">this field is required</p>
          </div>

          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="with-icon">
              Input with icon
            </Label>
            <div className="np-fsg__icon-wrap">
              <Input id="with-icon" placeholder="search..." />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="np-fsg__group">
        <div className="np-fsg__group-header">
          <span className="np-fsg__group-title">Input types</span>
          <span className="np-fsg__group-desc">
            Various input types for different data collection needs.
          </span>
        </div>
        <div className="np-fsg__grid">
          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="email-input">
              Email input
            </Label>
            <Input
              id="email-input"
              type="email"
              placeholder="user@example.com"
            />
          </div>

          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="password-input">
              Password input
            </Label>
            <Input
              id="password-input"
              type="password"
              placeholder="enter your password"
            />
          </div>

          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="number-input">
              Number input
            </Label>
            <Input id="number-input" type="number" placeholder="0" />
          </div>

          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="date-input">
              Date input
            </Label>
            <Input id="date-input" type="date" />
          </div>
        </div>
      </div>

      <div className="np-fsg__group">
        <div className="np-fsg__group-header">
          <span className="np-fsg__group-title">Textarea</span>
          <span className="np-fsg__group-desc">
            Multi-line text inputs for larger content.
          </span>
        </div>
        <div className="np-fsg__grid">
          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="default-textarea">
              Default textarea
            </Label>
            <Textarea id="default-textarea" placeholder="enter your message" />
          </div>

          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="disabled-textarea">
              Disabled textarea
            </Label>
            <Textarea
              id="disabled-textarea"
              placeholder="this textarea is disabled"
              disabled
            />
          </div>
        </div>
      </div>

      <div className="np-fsg__group">
        <div className="np-fsg__group-header">
          <span className="np-fsg__group-title">Input sizes</span>
          <span className="np-fsg__group-desc">
            Different input sizes for various contexts.
          </span>
        </div>
        <div className="np-fsg__field">
          <Label className="np-fsg__label" htmlFor="sm-input">
            Small input
          </Label>
          <Input
            id="sm-input"
            className="h-8 px-2 py-1 text-xs"
            placeholder="small input"
          />
        </div>
        <div className="np-fsg__field">
          <Label className="np-fsg__label" htmlFor="default-size-input">
            Default input
          </Label>
          <Input id="default-size-input" placeholder="default input" />
        </div>
        <div className="np-fsg__field">
          <Label className="np-fsg__label" htmlFor="lg-input">
            Large input
          </Label>
          <Input
            id="lg-input"
            className="h-12 px-4 py-3 text-base"
            placeholder="large input"
          />
        </div>
      </div>

      <div className="np-fsg__group">
        <div className="np-fsg__group-header">
          <span className="np-fsg__group-title">Form example</span>
          <span className="np-fsg__group-desc">
            Complete form example with various input types.
          </span>
        </div>
        <form className="np-fsg__form-example np-fsg__grid">
          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="form-first-name">
              First name
            </Label>
            <Input id="form-first-name" placeholder="john" />
          </div>

          <div className="np-fsg__field">
            <Label className="np-fsg__label" htmlFor="form-last-name">
              Last name
            </Label>
            <Input id="form-last-name" placeholder="doe" />
          </div>

          <div className="np-fsg__field np-fsg__grid--1">
            <Label className="np-fsg__label" htmlFor="form-email">
              Email
            </Label>
            <Input
              id="form-email"
              type="email"
              placeholder="john.doe@example.com"
            />
          </div>

          <div className="np-fsg__field np-fsg__grid--1">
            <Label className="np-fsg__label" htmlFor="form-message">
              Message
            </Label>
            <Textarea id="form-message" placeholder="your message here..." />
          </div>

          <div className="np-fsg__form-actions np-fsg__grid--1">
            <Button variant="outline" className="np-fsg__btn-ghost">Cancel</Button>
            <Button>Submit</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
