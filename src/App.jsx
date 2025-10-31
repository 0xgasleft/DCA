import { FaTools } from "react-icons/fa";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { inject } from "@vercel/analytics";

export default function App() {
  inject();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700 text-white text-center p-6">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-10 max-w-md w-full border border-white/20">
        <div className="flex justify-center mb-6">
          <FaTools className="text-6xl animate-pulse" />
        </div>
        <h1 className="text-3xl font-bold mb-4">App is being reworked</h1>
        <p className="text-lg text-white/80 mb-6">
          We’re upgrading this app to bring you a smoother experience.
          Please check back soon!
        </p>
      </div>

      <footer className="mt-10 text-white/60 text-sm">
        © {new Date().getFullYear()} InkDCA — All Rights Reserved
      </footer>

      <SpeedInsights />
    </div>
  );
}
