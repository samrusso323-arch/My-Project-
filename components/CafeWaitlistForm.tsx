'use client';

import { useState, FormEvent } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'already' | 'error';

export default function CafeWaitlistForm() {
  const [cafeName, setCafeName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/cafe-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cafeName, email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      if (data.alreadyJoined) {
        setStatus('already');
        setMessage("You're already on the list — we'll be in touch!");
      } else {
        setStatus('success');
        setMessage("Thanks! We'll reach out when Coff Coff launches in your area.");
        setCafeName('');
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="cafeName" className="sr-only">
          Cafe name
        </label>
        <input
          id="cafeName"
          type="text"
          required
          placeholder="Your cafe's name"
          value={cafeName}
          onChange={(e) => setCafeName(e.target.value)}
          disabled={status === 'loading' || isDone}
          className="rounded-full border border-roast/30 bg-white px-5 py-3 text-espresso placeholder:text-roast/40 focus:outline-none focus:ring-2 focus:ring-clay disabled:opacity-60"
        />
        <label htmlFor="cafeEmail" className="sr-only">
          Email address
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
          <input
            id="cafeEmail"
            type="email"
            required
            placeholder="you@yourcafe.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading' || isDone}
            className="flex-1 rounded-full border border-roast/30 bg-white px-5 py-3 text-espresso placeholder:text-roast/40 focus:outline-none focus:ring-2 focus:ring-clay disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={status === 'loading' || isDone}
            className="rounded-full bg-espresso px-6 py-3 font-semibold text-cream transition hover:bg-espresso/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === 'loading'
              ? 'Submitting…'
              : isDone
              ? 'On the list ✓'
              : 'List my cafe'}
          </button>
        </div>
      </form>
      {message && (
        <p
          role="status"
          className={`mt-3 text-sm ${
            status === 'error' ? 'text-red-600' : 'text-roast'
          }`}
        >
          {message}
        </p>
      )}
      <p className="mt-2 text-xs text-roast/60">
        Free to join. No spam, ever.
      </p>
    </div>
  );
}
