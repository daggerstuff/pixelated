import React, { useState } from "react";
import { FormSubmitEvent } from "astro";
import { RegisterSchema } from "@/lib/validation/registerSchema";

export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState({
    email: "",
    password: "",
    fullName: "",
    termsAccepted: false,
  });

  const schema = RegisterSchema;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setUser((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: FormSubmitEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = schema.safeParse(user);
    if (!result.success) {
      setError(result.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(result.data),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        setIsLoading(false);
        return;
      }

      // On success, redirect to login or dashboard
      window.location.assign("/login");
    } catch {
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container max-w-md w-full p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Create Account</h2>

      {error && (
        <div
          className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg"
          role="alert"
        >
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        {["fullName", "email", "password", "termsAccepted"].map((field) => (
          <div key={field} className="mb-4">
            {(() => {
              switch (field) {
                case "fullName":
                  return (
                    <>
                      <label
                        className="block text-sm font-medium text-gray-700"
                        htmlFor={field}
                      >
                        Full Name
                      </label>
                      <input
                        id={field}
                        type="text"
                        name={field}
                        value={user[field as keyof typeof user] as string}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:ring-offset-0"
                        required
                      />
                    </>
                  );
                case "email":
                  return (
                    <>
                      <label
                        className="block text-sm font-medium text-gray-700"
                        htmlFor={field}
                      >
                        Email Address
                      </label>
                      <input
                        id={field}
                        type="email"
                        name={field}
                        value={user[field as keyof typeof user] as string}
                        onChange={handleChange}
                        autoComplete="email"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:ring-offset-0"
                        required
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Must be a valid email address
                      </p>
                    </>
                  );
                case "password":
                  return (
                    <>
                      <label
                        className="block text-sm font-medium text-gray-700"
                        htmlFor={field}
                      >
                        Password
                      </label>
                      <input
                        id={field}
                        type="password"
                        name={field}
                        value={user[field as keyof typeof user] as string}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:ring-offset-0"
                        required
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Must be at least 6 characters
                      </p>
                    </>
                  );
                case "termsAccepted":
                  return (
                    <>
                      <div className="flex items-center space-x-2">
                        <input
                          id={field}
                          type="checkbox"
                          name={field}
                          checked={user[field] as boolean}
                          onChange={handleChange}
                          className="h-4 w-4 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:ring-offset-0"
                        />
                        <label
                          htmlFor={field}
                          className="text-sm text-gray-500"
                        >
                          I agree to the
                          <a
                            href="/terms"
                            className="text-sm text-indigo-600 hover:text-indigo-500 underline"
                          >
                            Terms of Service
                          </a>
                        </label>
                      </div>
                      <p
                        className="text-xs text-gray-400 mt-1 text-red-500 hidden"
                        id="terms-error"
                      >
                        You must accept the Terms of Service
                      </p>
                    </>
                  );
              }
            })()}
          </div>
        ))}

        {error && (
          <div
            className="mb-4 p-2 bg-red-100 text-red-800 rounded-lg"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 transition-colors"
        >
          {isLoading ? "Creating Account..." : "Register"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <span className="text-sm text-gray-500">Already have an account?</span>
        <a
          href="/login"
          className="text-sm text-indigo-600 hover:text-indigo-500 underline"
        >
          Sign in
        </a>
      </div>
    </div>
  );
}
