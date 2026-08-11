'use client';

import { useState, FormEvent } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'already' | 'error';

export default function WaitlistForm({
  variant = 'light',
}: {
  variant?: 'light' | 'dark';
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      if (data.alreadyJoined) {
        setStatus('already');
        setMessage("You're already on the list — hang tight!");
      } else {
        setStatus('success');
        setMessage("You're in! We'll email you when Coff Coff launches.");
        setEmail('');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  const isDone = status === 'success' || status === 'already';

  return (
    <div className="w-full max-w-md">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:gap-2"
      >
        <label htmlFor="email" className="sr-only">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'loading' || isDone}
          className="flex-1 rounded-full border border-roast/30 bg-white px-5 py-3 text-espresso placeholder:text-roast/40 focus:outline-none focus:ring-2 focus:ring-clay disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === 'loading' || isDone}
          className="rounded-full bg-clay px-6 py-3 font-semibold text-cream transition hover:bg-clay/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === 'loading'
            ? 'Joining…'
            : isDone
            ? 'On the list ✓'
            : 'Join the waitlist'}
        </button>
      </form>
      {message && (
        <p
          role="status"
          className={`mt-3 text-sm ${
            status === 'error'
              ? 'text-red-400'
              : variant === 'dark'
              ? 'text-cream'
              : 'text-roast'
          }`}
        >
          {message}
        </p>
      )}
      <p
        className={`mt-2 text-xs ${
          variant === 'dark' ? 'text-cream/60' : 'text-roast/60'
        }`}
      >
        No spam, ever. Just one email when we launch.
      </p>
    </div>
  );
}
