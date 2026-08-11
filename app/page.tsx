import WaitlistForm from '@/components/WaitlistForm';
import CafeWaitlistForm from '@/components/CafeWaitlistForm';

const features = [
  {
    title: 'Real reviews, real coffee people',
    body: 'Ratings from actual regulars — not tourists chasing a five-star average. Know what a place is really like before you go.',
    icon: '☕',
  },
  {
    title: 'Find your vibe',
    body: 'Filter by what matters: quiet for working, great oat milk, outdoor seating, fast wifi, or the best espresso in town.',
    icon: '🔎',
  },
  {
    title: 'Track your coffee trail',
    body: 'Log the cafes you visit, rate your drinks, and build a personal map of every great cup you\'ve had.',
    icon: '🗺️',
  },
];

const steps = [
  { n: '01', title: 'Search your city', body: 'See every cafe nearby, ranked by real reviews from people who actually drink coffee.' },
  { n: '02', title: 'Read the details', body: 'Vibe, wifi, seating, milk options, and the drinks worth ordering — all in one place.' },
  { n: '03', title: 'Rate & share', body: 'Leave your own review and help other coffee lovers find their next favorite spot.' },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-cream">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">☕</span>
          <span className="font-display text-xl font-bold tracking-tight text-espresso">
            Coff Coff
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="#cafe-owners"
            className="hidden text-sm font-medium text-espresso underline-offset-4 hover:underline sm:inline"
          >
            For cafe owners
          </a>
          <a
            href="#waitlist"
            className="rounded-full border border-espresso/20 px-4 py-2 text-sm font-medium text-espresso transition hover:bg-espresso hover:text-cream"
          >
            Join waitlist
          </a>
        </div>
      </header>

      <section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 pb-20 pt-12 text-center sm:pt-20">
        <span className="rounded-full bg-latte/30 px-4 py-1 text-sm font-medium text-roast">
          Launching soon
        </span>
        <h1 className="font-display max-w-3xl text-4xl font-bold leading-tight text-espresso sm:text-6xl">
          Find your next favorite coffee shop.
        </h1>
        <p className="max-w-xl text-lg text-roast">
          Coff Coff is a review service built by coffee people, for coffee
          people — honest ratings, real vibes, and the best cafes near you.
        </p>
        <div id="waitlist" className="mt-4 flex flex-col items-center gap-3 scroll-mt-24">
          <WaitlistForm />
        </div>
      </section>

      <section className="bg-white/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-center text-3xl font-bold text-espresso">
            Why Coff Coff
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-roast/10 bg-cream p-6 text-center shadow-sm"
              >
                <div className="text-4xl">{f.icon}</div>
                <h3 className="mt-4 font-display text-lg font-semibold text-espresso">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm text-roast">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-center text-3xl font-bold text-espresso">
            How it works
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="font-display text-4xl font-bold text-latte">
                  {s.n}
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold text-espresso">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-roast">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-espresso py-20 text-cream">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 text-center">
          <h2 className="font-display text-3xl font-bold">
            Be first through the door.
          </h2>
          <p className="max-w-lg text-cream/80">
            Join the waitlist and get early access when Coff Coff launches in
            your city, plus first pick of founding member perks.
          </p>
          <WaitlistForm variant="dark" />
        </div>
      </section>

      <section
        id="cafe-owners"
        className="bg-latte/20 py-20 scroll-mt-24"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 text-center">
          <span className="rounded-full bg-white px-4 py-1 text-sm font-medium text-roast">
            For cafe owners
          </span>
          <h2 className="font-display max-w-2xl text-3xl font-bold text-espresso">
            Own a cafe? Get listed before we launch.
          </h2>
          <p className="max-w-lg text-roast">
            Claim your cafe's profile early, reach coffee lovers actively
            looking for their next favorite spot, and get featured placement
            when Coff Coff goes live in your city.
          </p>
          <CafeWaitlistForm />
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-10 text-center text-sm text-roast/60">
        <span>☕ Coff Coff</span>
        <span>&copy; {new Date().getFullYear()} Coff Coff. All rights reserved.</span>
      </footer>
    </main>
  );
}
