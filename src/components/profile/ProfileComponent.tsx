'use client'

import React, { useState, useEffect } from 'react'
import type { User } from '@/types/user'
import { SkeletonProfile } from '@/components/ui/skeleton'

interface ProfileComponentProps {
  user: User
}

export function ProfileComponent({ user }: ProfileComponentProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    bio: '',
    profession: '',
    specialization: '',
    experience: '',
  })

  // Simulate loading state on initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Show loading state while saving
    setIsLoading(true)

    // Here you would typically send the updated profile to the server
    console.log('Updated profile:', formData)

    // Mock successful update with delay
    setTimeout(() => {
      setIsLoading(false)
      setIsEditing(false)
      // Show success toast or message
    }, 1000)
  }

  if (isLoading) {
    return <SkeletonProfile />
  }

  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-center w-full">
            Edit Profile
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-border rounded-md bg-card"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-border rounded-md bg-card"
              required
              disabled
            />

            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact support for assistance.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="bio" className="block text-sm font-medium">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-card resize-none"
              placeholder="Tell us a bit about yourself"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="profession" className="block text-sm font-medium">
                Profession
              </label>
              <input
                id="profession"
                name="profession"
                type="text"
                value={formData.profession}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-md bg-card"
                placeholder="e.g. Psychologist, Therapist"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="specialization"
                className="block text-sm font-medium"
              >
                Specialization
              </label>
              <input
                id="specialization"
                name="specialization"
                type="text"
                value={formData.specialization}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-md bg-card"
                placeholder="e.g. CBT, Trauma"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="experience" className="block text-sm font-medium">
              Years of Experience
            </label>
            <input
              id="experience"
              name="experience"
              type="text"
              value={formData.experience}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-border rounded-md bg-card"
              placeholder="e.g. 5"
            />
          </div>

          <div className="pt-4 flex gap-4 justify-end">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-border rounded-md text-sm font-medium transition-colors hover:bg-accent"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium transition-colors hover:bg-primary/90 flex items-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-center w-full">
          Profile Information
        </h3>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center overflow-hidden">
            {user?.name ? (
              <span className="text-2xl font-bold text-primary">
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </span>
            ) : (
              <span className="material-symbols-outlined text-3xl text-primary">
                person
              </span>
            )}
          </div>
          <button className="mt-4 text-xs text-primary hover:underline">
            Upload Photo
          </button>
        </div>

        <div className="flex-grow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">
                Full Name
              </h4>
              <p>{user?.name || 'Not set'}</p>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">
                Email Address
              </h4>
              <p>{user?.email || 'Not set'}</p>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">
                Profession
              </h4>
              <p>Not set</p>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">
                Specialization
              </h4>
              <p>Not set</p>
            </div>

            <div className="space-y-1 md:col-span-2">
              <h4 className="text-sm font-medium text-muted-foreground">Bio</h4>
              <p className="text-sm">No bio available</p>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium transition-colors hover:bg-primary/90"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6 mt-6">
        <h4 className="font-medium mb-4 text-center">Account Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">
              Account Type
            </h4>
            <p>Professional (Licensed)</p>
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">
              Member Since
            </h4>
            <p>{new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">
              Last Login
            </h4>
            <p>{new Date().toLocaleString()}</p>
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">
              Subscription
            </h4>
            <p>
              <span className="inline-block px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                Pro Plan
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
