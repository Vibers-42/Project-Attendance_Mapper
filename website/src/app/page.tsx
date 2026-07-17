import { redirect } from 'next/navigation';

export default function Home() {
  // Root URL redirects immediately to the main dashboard
  redirect('/dashboard');
}
