import { FeatureRolloutPanel } from './FeatureRolloutPanel';

const FeatureRolloutPage = () => (
  <div className="mx-auto w-full max-w-[1440px] space-y-5">
    <div>
      <h2 className="text-2xl font-bold text-slate-900">Tính năng thử nghiệm</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
        Bật, tắt hoặc thử nghiệm theo từng nhóm người dùng mà không cần deploy lại; mọi thay đổi đều có phiên bản, lý do và khả năng hoàn tác.
      </p>
    </div>
    <FeatureRolloutPanel />
  </div>
);

export default FeatureRolloutPage;
