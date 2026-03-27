import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { Github, ArrowRight, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { MouseEvent, useEffect } from "react";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate({ to: "/", search: { w: undefined } });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)] pointer-events-none opacity-30" />
      
      {/* Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-cyan-600/20 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/20 blur-[150px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 80, damping: 20 }}
        onMouseMove={handleMouseMove}
        className="group relative w-full max-w-md bg-[#0a0a0c] border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10"
      >
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100 mix-blend-screen"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                600px circle at ${mouseX}px ${mouseY}px,
                rgba(6, 182, 212, 0.15),
                transparent 80%
              )
            `,
          }}
        />

        <div className="relative z-10 p-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center text-black font-black text-2xl shadow-[0_0_30px_rgba(6,182,212,0.4)] mb-8">
            iT
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">iTECify</span>
          </h1>
          <p className="text-sm text-gray-400 mb-10 max-w-xs leading-relaxed">
            The premium collaborative environment for modern developers. Secure your identity to continue.
          </p>

          <button
            onClick={() => loginWithRedirect({ authorizationParams: { connection: "github" } })}
            disabled={isLoading}
            className="group relative w-full px-6 py-4 bg-[#18181b] hover:bg-[#27272a] text-white font-semibold rounded-xl transition-all border border-white/10 hover:border-cyan-500/50 shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] flex items-center justify-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-purple-500/0 w-[200%] h-full -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
            {isLoading ? (
              <Zap className="animate-pulse text-cyan-400" size={20} />
            ) : (
              <Github size={20} className="text-white group-hover:scale-110 transition-transform" />
            )}
            {isLoading ? "Authenticating..." : "Login with GitHub"}
            {!isLoading && <ArrowRight size={16} className="absolute right-6 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" />}
          </button>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-default">
              <ShieldCheck size={14} /> End-to-end Safe
            </div>
            <div className="flex items-center gap-1.5 hover:text-purple-400 transition-colors cursor-default">
              <Sparkles size={14} /> AI Ready
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;
