import { motion, AnimatePresence } from "motion/react";

interface NewMemberModalProps {
  onClose: () => void;
}

export default function NewMemberModal({ onClose }: NewMemberModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        key="nm-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          key="nm-card"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
          className="w-full max-w-sm relative"
          onClick={e => e.stopPropagation()}
        >
          {/* Soft glow */}
          <div
            className="absolute inset-0 rounded-2xl blur-xl opacity-40 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 40%, #a855f7 0%, transparent 65%)" }}
          />

          <div
            className="relative rounded-2xl p-6 border"
            style={{
              background: "linear-gradient(135deg, #130d28 0%, #0d0a1f 100%)",
              borderColor: "rgba(168,85,247,0.35)",
              boxShadow: "0 0 40px rgba(168,85,247,0.15), 0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Gift emoji */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
              className="text-5xl text-center mb-4"
            >
              🎁
            </motion.div>

            <h2 className="text-xl font-bold text-center text-white mb-2">
              Selamat datang di Lovemelodia 🎁
            </h2>
            <p className="text-sm text-center mb-6" style={{ color: "rgba(255,255,255,0.65)" }}>
              Kamu punya <strong className="text-white">3 hadiah gratis</strong> untuk mulai. Pilih momen, buat lagunya, dan kirim ke orang tersayang.
            </p>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(168,85,247,0.35)",
              }}
            >
              Mulai Bikin Lagu
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
