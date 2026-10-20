"use client";

import { useState } from "react";
import { useGroupError } from "@/components/admin/form";

type Day = { day: string; label: string; closed: boolean; opens: string; closes: string };

/** Seven-day hours grid. When switched off, no hours are published at all. */
export function HoursEditor({ enabled, days }: { enabled: boolean; days: Day[] }) {
  const [on, setOn] = useState(enabled);
  const [closed, setClosed] = useState<Record<string, boolean>>(Object.fromEntries(days.map((d) => [d.day, d.closed])));
  const error = useGroupError("hours");
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="hoursEnabled" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-4 w-4 accent-[#1c1b19]" />
        Publish opening hours
      </label>
      {on && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="text-left text-xs text-[#6b665e]">
                <th className="pb-2 font-medium">Day</th>
                <th className="pb-2 font-medium">Closed</th>
                <th className="pb-2 font-medium">Opens</th>
                <th className="pb-2 font-medium">Closes</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-t border-[#f0ede8]">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    {d.label}
                  </th>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      name={`hours.${d.day}.closed`}
                      checked={closed[d.day]}
                      onChange={(e) => setClosed((c) => ({ ...c, [d.day]: e.target.checked }))}
                      aria-label={`${d.label} closed`}
                      className="h-4 w-4 accent-[#1c1b19]"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input type="time" name={`hours.${d.day}.opens`} defaultValue={d.opens} disabled={closed[d.day]} aria-label={`${d.label} opens`} className="admin-input max-w-[130px]" />
                  </td>
                  <td className="py-2">
                    <input type="time" name={`hours.${d.day}.closes`} defaultValue={d.closes} disabled={closed[d.day]} aria-label={`${d.label} closes`} className="admin-input max-w-[130px]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p className="mt-2 text-xs font-medium text-[#b42318]">{error}</p>}
    </div>
  );
}
