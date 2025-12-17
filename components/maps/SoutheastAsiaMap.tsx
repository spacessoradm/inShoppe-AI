export default function SoutheastAsiaMap() {
  return (
    <div className="relative w-full h-[460px] bg-black">
      <svg
        viewBox="0 0 1000 700"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="#2f3b8f">
          {/* Mainland SEA */}
          <path d="M281 78 L240 128 L230 188 L255 250 L280 320 L300 380 L340 420 L370 400 L360 330 L350 260 L370 200 L390 160 L360 110 Z" />
          {/* Vietnam */}
          <path d="M400 120 L420 180 L430 250 L420 330 L400 380 L420 410 L450 360 L460 280 L450 200 L420 150 Z" />
          {/* Malaysia Peninsula */}
          <path d="M310 420 L290 460 L300 520 L330 590 L350 560 L340 500 L330 460 Z" />
          {/* Borneo */}
          <path d="M460 420 L540 400 L600 430 L620 500 L580 560 L500 580 L470 520 Z" />
          {/* Sumatra */}
          <path d="M230 440 L190 480 L180 540 L210 590 L240 560 L260 500 Z" />
          {/* Java */}
          <path d="M280 600 L380 600 L380 620 L280 620 Z" />
          {/* Philippines */}
          <path d="M640 220 L660 260 L690 240 L670 200 Z" />
          <path d="M660 300 L690 330 L720 310 L690 280 Z" />
        </g>
      </svg>

      {/* PINS */}
      <Pin label="Thailand" style={{ top: "28%", left: "33%" }} />
      <Pin label="Vietnam" style={{ top: "33%", left: "44%" }} />
      <Pin label="Malaysia" style={{ top: "55%", left: "35%" }} />
      <Pin label="Singapore" style={{ top: "60%", left: "36%" }} />
      <Pin label="Indonesia" style={{ top: "72%", left: "45%" }} />
    </div>
  );
}

function Pin({
  label,
  style,
}: {
  label: string;
  style: React.CSSProperties;
}) {
  return (
    <div
      className="absolute z-20 flex flex-col items-center text-white text-xs"
      style={style}
    >
      <div className="bg-white text-black px-2 py-1 rounded shadow">
        {label}
      </div>
      <div className="w-1 h-3 bg-white" />
      <div className="w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white" />
    </div>
  );
}
