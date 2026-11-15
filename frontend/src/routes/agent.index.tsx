import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, ArrowRight } from "lucide-react";
import { motion, type Variants } from "framer-motion";

export const Route = createFileRoute("/agent/")({
  component: AgentHub,
});

const cardVariantsCenter: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 60,
      damping: 18,
      delay: 0.15,
    },
  },
};

function AgentHub() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* Top Badge */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-xs font-semibold text-foreground shadow-xs backdrop-blur-xs">
            NEXUS Cognitive Foundry Intelligence
          </div>
        </div>

        {/* Main Title & Subtitle */}
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h1 className="mb-4 font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            Hey! What would you like to do?
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Run predictive Physics-Informed Neural Network (PINN) what-if simulations across melting, molding, and pouring stages.
          </p>
        </div>

        {/* Centered What-IF Simulation Card */}
        <div className="mx-auto mb-10 flex max-w-md justify-center">
          <motion.div
            variants={cardVariantsCenter}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -6, scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            className="w-full"
          >
            <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-[#442211] bg-gradient-to-b from-[#3a1d0d] to-[#0a0a0a] p-8 shadow-xl transition-all duration-300 hover:border-[#ff6a00]/40 hover:shadow-[0_20px_40px_-15px_rgba(255,106,0,0.25)]">
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8a3800] to-[#ff6a00] text-white shadow-md">
                    <Zap className="size-7" />
                  </div>
                  <span className="rounded-full border border-[#ff6a00]/30 bg-[#ff6a00]/10 px-3.5 py-1 text-xs font-semibold text-[#FFA033]">
                    PINN Simulation
                  </span>
                </div>

                <h2 className="mb-2 text-2xl font-bold text-white">
                  What-IF Simulation
                </h2>
                <p className="text-sm leading-relaxed text-[#AAAAAA]">
                  Physics-Informed Neural Network simulation for melt setpoints, green sand moisture, and pouring kinematics.
                </p>
              </div>

              <div>
                <div className="my-6 border-t border-[#442211]" />
                <Link
                  to="/agent/pinn"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8a3800] to-[#ff6a00] py-3.5 px-6 text-sm font-semibold text-white transition-all shadow-md hover:brightness-110 active:scale-[0.99]"
                >
                  Launch What-IF Simulation
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}



