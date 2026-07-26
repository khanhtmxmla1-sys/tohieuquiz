import { AnimatePresence, motion } from 'framer-motion';
import type { StudentRewardsController } from '../hooks/useStudentRewards';

export const RewardModal = ({ rewards }: { rewards: StudentRewardsController }) => (
  <AnimatePresence>
    {rewards.rewardSummary && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center"
        onClick={rewards.clearReward}>
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center">
          <div className="text-5xl mb-3">{rewards.rewardSummary.icon}</div>
          <h3 className="text-xl font-black text-slate-800 mb-2">{rewards.rewardSummary.title}</h3>
          <p className="text-sm text-slate-500 font-medium">{rewards.rewardSummary.description}</p>
          <button type="button" onClick={rewards.clearReward}
            className="mt-6 w-full py-3 rounded-2xl bg-violet-600 text-white font-black hover:bg-violet-700 transition-colors">
            Tiếp tục hành trình
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
