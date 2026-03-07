import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

/**
 * Form Style Guide Component
 *
 * This component displays standardized form inputs and their various states
 * to serve as a reference for consistent form styling across the application.
 */
export function FormStyleGuide() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Text Inputs</h2>
        <p className="text-muted-foreground">
          Standard text inputs for collecting user information.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-input">Default Input</Label>
            <Input id="default-input" placeholder="Enter your name" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="disabled-input">Disabled Input</Label>
            <Input
              id="disabled-input"
              placeholder="This input is disabled"
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="error-input">Input with Error</Label>
            <Input
              id="error-input"
              placeholder="Invalid input"
              className="border-destructive focus-visible:ring-destructive"
            />

            <p className="text-sm text-destructive">This field is required</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="with-icon">Input with Icon</Label>
            <div className="relative">
              <Input id="with-icon" placeholder="Search..." />

              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-muted-foreground"
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

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Input Types</h2>
        <p className="text-muted-foreground">
          Various input types for different data collection needs.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email-input">Email Input</Label>
            <Input
              id="email-input"
              type="email"
              placeholder="user@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password-input">Password Input</Label>
            <Input
              id="password-input"
              type="password"
              placeholder="Enter your password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="number-input">Number Input</Label>
            <Input id="number-input" type="number" placeholder="0" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-input">Date Input</Label>
            <Input id="date-input" type="date" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Textarea</h2>
        <p className="text-muted-foreground">
          Multi-line text inputs for larger content.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-textarea">Default Textarea</Label>
            <Textarea id="default-textarea" placeholder="Enter your message" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="disabled-textarea">Disabled Textarea</Label>
            <Textarea
              id="disabled-textarea"
              placeholder="This textarea is disabled"
              disabled
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Input Sizes</h2>
        <p className="text-muted-foreground">
          Different input sizes for various contexts.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sm-input">Small Input</Label>
            <Input
              id="sm-input"
              className="h-8 px-2 py-1 text-xs"
              placeholder="Small input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-size-input">Default Input</Label>
            <Input id="default-size-input" placeholder="Default input" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lg-input">Large Input</Label>
            <Input
              id="lg-input"
              className="h-12 px-4 py-3 text-base"
              placeholder="Large input"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Form Example</h2>
        <p className="text-muted-foreground">
          Complete form example with various input types.
        </p>
        <form className="space-y-4 p-4 border rounded-md">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="form-first-name">First Name</Label>
              <Input id="form-first-name" placeholder="John" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-last-name">Last Name</Label>
              <Input id="form-last-name" placeholder="Doe" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-email">Email</Label>
            <Input
              id="form-email"
              type="email"
              placeholder="john.doe@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="form-message">Message</Label>
            <Textarea id="form-message" placeholder="Your message here..." />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline">Cancel</Button>
            <Button>Submit</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FormStyleGuide
