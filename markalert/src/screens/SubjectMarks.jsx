// Replace with your real data / API
const subject = {
  name: "Distributed Computing", code: "23CST504", total: "00",
  parts: [
    { label: "Internal 1", got: 0, max: 50 },
    { label: "Internal 2", got: 0, max: 50 },
    { label: "Assignment", got: 0, max: 10 },
  ],
};

export default function SubjectMarks({ onBack, onMessageFaculty, onDownload }) {
  return (
    <div className="min-h-screen bg-cream text-[#2b0a10] font-sans px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-10">
      <button onClick={onBack} className="text-sm text-maroon-700 font-semibold mb-3">← Back</button>
      <p className="text-[13px] text-[#6b5a3a]">Subject</p>
      <h1 className="font-display text-[32px] font-bold text-maroon-700 leading-tight">{subject.name}</h1>
      <p className="mt-1 text-[13px] text-[#6b5a3a]">{subject.code}</p>

      <div className="mt-6 rounded-[22px] p-6 text-center bg-gradient-to-br from-maroon-600 to-maroon-800 shadow-[0_12px_28px_rgba(110,13,28,.28)]">
        <p className="text-xs tracking-[.18em] uppercase text-gold-300">Total internal</p>
        <p className="mt-2 font-display text-[64px] font-bold leading-none text-gold-300">
          {subject.total}<span className="text-2xl text-cream"> / 100</span>
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        {subject.parts.map((p) => (
          <div key={p.label}>
            <div className="flex justify-between text-[13px] mb-1.5">
              <span>{p.label}</span>
              <span className="font-semibold text-maroon-700">{p.got} / {p.max}</span>
            </div>
            <div className="h-2 rounded-full bg-[#efe3b8]">
              <div className="h-full rounded-full bg-gradient-to-r from-maroon-700 to-gold-500"
                   style={{ width: `${(p.got / p.max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <button onClick={onDownload} className="mt-8 w-full h-[52px] rounded-full bg-gradient-to-r from-gold-300 to-gold-500 text-[#3a0710] text-[15px] font-semibold">
        Download marks report
      </button>
      <button onClick={onMessageFaculty} className="mt-3 w-full h-[52px] rounded-full border-[1.5px] border-maroon-700 text-maroon-700 text-[15px] font-semibold">
        Message faculty
      </button>
    </div>
  );
}
