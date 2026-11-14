import BottomNav from "../components/BottomNav";
import { ChartIcon, ChatIcon, UserIcon, BellIcon } from "../components/Icons";

// Replace with your real data / API
const student = { name: "Student Name", sem: "Semester 5 · Information Technology", average: "00.0" };
const latest = [
  { code: "DC", subject: "Distributed Computing", exam: "Internal 1", mark: "00" },
  { code: "ES", subject: "Embedded Systems and IoT", exam: "Internal 1", mark: "00" },
  { code: "CN", subject: "Computer Networks", exam: "Internal 1", mark: "00" },
];
const actions = [
  { label: "Marks", Icon: ChartIcon }, { label: "Messages", Icon: ChatIcon },
  { label: "Faculty", Icon: UserIcon }, { label: "Alerts", Icon: BellIcon },
];

export default function Home({ onNavigate, onOpenSubject }) {
  return (
    <div className="min-h-screen bg-cream text-[#2b0a10] font-sans px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-28">
      <p className="text-[13px] text-[#6b5a3a]">Welcome back</p>
      <h1 className="font-display text-[34px] font-bold text-maroon-700 leading-tight">{student.name}</h1>

      <div className="mt-5 rounded-[22px] p-[22px] text-cream bg-gradient-to-br from-maroon-600 to-maroon-800 shadow-[0_12px_28px_rgba(110,13,28,.28)]">
        <p className="text-xs tracking-[.18em] uppercase font-semibold text-gold-300">Internal average</p>
        <p className="mt-1.5 font-display text-[56px] font-bold leading-none text-gold-300">
          {student.average}<span className="text-[22px] text-cream"> / 50</span>
        </p>
        <p className="mt-2.5 text-[13px]">{student.sem}</p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2.5">
        {actions.map(({ label, Icon }) => (
          <button key={label} onClick={() => onNavigate?.(label.toLowerCase())}
            className="rounded-2xl bg-white border border-[#ecdcae] py-3.5 px-2 text-center">
            <span className="mx-auto w-10 h-10 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-maroon-900 flex items-center justify-center"><Icon /></span>
            <span className="block mt-2 text-xs font-semibold">{label}</span>
          </button>
        ))}
      </div>

      <h2 className="mt-6 mb-3 text-[15px] font-semibold text-maroon-700">Latest marks</h2>
      <div className="flex flex-col gap-2.5">
        {latest.map((m) => (
          <button key={m.code} onClick={() => onOpenSubject?.(m)}
            className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-[#ecdcae] text-left">
            <span className="w-11 h-11 rounded-xl bg-maroon-700 text-gold-300 text-[13px] font-semibold flex items-center justify-center">{m.code}</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{m.subject}</span>
              <span className="block mt-0.5 text-xs text-[#6b5a3a]">{m.exam}</span>
            </span>
            <span className="text-xl font-semibold text-maroon-700">{m.mark}</span>
          </button>
        ))}
      </div>

      <BottomNav active="home" onChange={onNavigate} />
    </div>
  );
}
