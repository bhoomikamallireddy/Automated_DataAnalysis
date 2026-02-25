export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-50">
      <div className="w-full max-w-3xl flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold text-zinc-900 mb-4">
          AutoEda Platform
        </h1>
        <p className="text-lg text-zinc-600 mb-8">
          Intelligent Automated Data Analysis MVP
        </p>
        
        <div className="grid gap-4 w-full max-w-md">
          <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm">
            <h2 className="font-semibold text-zinc-900 text-lg">System Status</h2>
            <p className="text-green-600 font-medium mt-1">✓ Backend Connected (PostgreSQL)</p>
            <p className="text-green-600 font-medium mt-1">✓ Frontend Ready (Next.js)</p>
          </div>
          
          <div className="p-4 text-zinc-400 text-xs font-mono">
            Location: frontend/app/page.js
          </div>
        </div>
      </div>
    </main>
  );
}