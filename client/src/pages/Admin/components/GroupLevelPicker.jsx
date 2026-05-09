import React, { useMemo, useRef } from "react";

const RED = "#e11d2e";

/**
 * GroupLevelPicker
 * ✅ Level Tabs: All Levels + unique levels from groups (and optional extraLevels)
 * ✅ Group Chips (filtered by selected level)
 * ✅ Optional counts per group
 *
 * Props:
 * - groups: [{_id,name,level}]
 * - level: string ("") means ALL
 * - onLevelChange: (levelStringOrEmpty) => void
 * - groupId: selected groupId ("" means ALL)
 * - onGroupChange: (groupIdOrEmpty) => void
 * - countsByGroupId: { [groupId]: number } (optional)
 * - title: string (optional)
 */
export default function GroupLevelPicker({
  groups = [],
  level = "",
  onLevelChange,
  groupId = "",
  onGroupChange,
  countsByGroupId = null,
  title = "Group & Level",
}) {
  const chipsRef = useRef(null);

  const levels = useMemo(() => {
    const set = new Set();
    (groups || []).forEach((g) => {
      const lv = String(g?.level || "").trim();
      if (lv) set.add(lv);
    });
    return ["", ...Array.from(set).sort((a, b) => a.localeCompare(b))]; // "" => ALL
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const lv = String(level || "").trim().toLowerCase();
    if (!lv) return groups || [];
    return (groups || []).filter((g) => String(g?.level || "").trim().toLowerCase() === lv);
  }, [groups, level]);

  function scroll(dir) {
    const el = chipsRef.current;
    if (!el) return;
    const dx = Math.max(260, Math.floor(el.clientWidth * 0.85));
    el.scrollBy({ left: dir === "L" ? -dx : dx, behavior: "smooth" });
  }

  return (
    <div className="glpCard">
      <div className="glpTop">
        <div>
          <div className="glpTitle">{title}</div>
          <div className="glpSub">Pick a level first, then select group (chips)</div>
        </div>

        <div className="glpQuick">
          <button
            type="button"
            className="glpBtn"
            onClick={() => {
              onLevelChange?.("");
              onGroupChange?.("");
              if (chipsRef.current) chipsRef.current.scrollLeft = 0;
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* LEVEL TABS */}
      <div className="glpBlock">
        <div className="glpLabel">Level</div>
        <div className="glpTabs">
          {levels.map((lv) => {
            const active = String(level || "") === String(lv || "");
            return (
              <button
                key={lv || "__ALL__"}
                type="button"
                className={`glpTab ${active ? "glpTabActive" : ""}`}
                onClick={() => {
                  onLevelChange?.(lv || "");
                  // If current group doesn't belong to this level, clear it
                  if (lv) {
                    const ok = (groups || []).some((g) => g?._id === groupId && String(g?.level || "").trim() === String(lv).trim());
                    if (!ok) onGroupChange?.("");
                  }
                  if (chipsRef.current) chipsRef.current.scrollLeft = 0;
                }}
                title={lv ? lv : "All Levels"}
              >
                {lv ? lv : "All Levels"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="glpDivider" />

      {/* GROUP CHIPS */}
      <div className="glpBlock">
        <div className="glpLabel">Group</div>

        <div className="glpChipsShell">
          <button className="glpScroll" type="button" onClick={() => scroll("L")} aria-label="Scroll left">
            ‹
          </button>

          <div className="glpChips" ref={chipsRef}>
            {/* ALL GROUPS chip */}
            <button
              type="button"
              className={`glpChip ${!groupId ? "glpChipActive" : ""}`}
              onClick={() => onGroupChange?.("")}
              title="All Groups"
            >
              <span className="glpChipName">All Groups</span>
            </button>

            {filteredGroups.map((g) => {
              const active = g?._id === groupId;
              const count = countsByGroupId ? Number(countsByGroupId[g._id] || 0) : null;

              return (
                <button
                  key={g._id}
                  type="button"
                  className={`glpChip ${active ? "glpChipActive" : ""}`}
                  onClick={() => onGroupChange?.(g._id)}
                  title={`${g.name}${g.level ? ` (${g.level})` : ""}`}
                >
                  <span className="glpChipName">{g.name}</span>
                  {g.level ? <span className="glpPill">{g.level}</span> : null}
                  {countsByGroupId ? <span className="glpCount">{count}</span> : null}
                </button>
              );
            })}

            {!filteredGroups.length ? <div className="glpEmpty">No groups under this level.</div> : null}
          </div>

          <button className="glpScroll" type="button" onClick={() => scroll("R")} aria-label="Scroll right">
            ›
          </button>
        </div>
      </div>

      <style>{`
        .glpCard{
          margin-top: 12px;
          border-radius: 18px;
          border: 1px solid rgba(17,24,39,0.10);
          background: rgba(255,255,255,0.78);
          padding: 12px;
        }
        .glpTop{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:12px;
          flex-wrap:wrap;
        }
        .glpTitle{ font-weight: 950; font-size: 13px; color:#0b1220; }
        .glpSub{ margin-top: 4px; font-size: 12px; opacity: .72; font-weight: 800; }
        .glpQuick{ display:flex; gap:10px; align-items:center; }

        .glpBtn{
          height: 36px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(17,24,39,0.12);
          background: rgba(255,255,255,0.88);
          font-weight: 950;
          cursor: pointer;
        }

        .glpBlock{ margin-top: 10px; }
        .glpLabel{ font-weight: 900; font-size: 12px; opacity: .78; margin-bottom: 8px; }

        .glpTabs{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          align-items:center;
        }
        .glpTab{
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(17,24,39,0.12);
          background: rgba(255,255,255,0.88);
          font-weight: 950;
          cursor: pointer;
          transition: transform .12s ease, box-shadow .2s ease, border-color .2s ease;
          white-space: nowrap;
        }
        .glpTab:hover{
          border-color: rgba(225,29,46,0.26);
          box-shadow: 0 12px 26px rgba(225,29,46,0.10);
        }
        .glpTab:active{ transform: translateY(1px) scale(0.99); }
        .glpTabActive{
          border-color: rgba(225,29,46,0.32);
          background: rgba(255,241,242,0.80);
          box-shadow: inset 0 0 0 2px rgba(225,29,46,0.10), 0 12px 28px rgba(225,29,46,0.10);
          color: ${RED};
        }

        .glpDivider{
          height: 1px;
          background: rgba(17,24,39,0.08);
          margin: 12px 0;
        }

        .glpChipsShell{ display:flex; gap:10px; align-items:center; }
        .glpScroll{
          width: 38px;
          height: 38px;
          border-radius: 14px;
          border: 1px solid rgba(17,24,39,0.12);
          background: rgba(255,255,255,0.88);
          font-weight: 950;
          cursor:pointer;
        }
        .glpChips{
          flex: 1;
          display:flex;
          gap:10px;
          overflow-x:auto;
          padding: 2px;
          scroll-behavior: smooth;
        }
        .glpChips::-webkit-scrollbar{ height: 8px; }
        .glpChips::-webkit-scrollbar-thumb{
          background: rgba(17,24,39,0.18);
          border-radius: 999px;
        }

        .glpChip{
          display:flex;
          align-items:center;
          gap:10px;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(17,24,39,0.12);
          background: rgba(255,255,255,0.88);
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
          transition: transform .12s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .glpChip:hover{
          border-color: rgba(225,29,46,0.22);
          box-shadow: 0 12px 26px rgba(2,8,23,0.08);
        }
        .glpChip:active{ transform: translateY(1px) scale(0.99); }

        .glpChipActive{
          border-color: rgba(225,29,46,0.32);
          background: rgba(255,241,242,0.82);
          color: ${RED};
          box-shadow: inset 0 0 0 2px rgba(225,29,46,0.10), 0 12px 28px rgba(225,29,46,0.10);
        }

        .glpChipName{ font-weight: 950; }
        .glpPill{
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(225,29,46,0.18);
          color: ${RED};
          font-weight: 950;
          font-size: 11px;
        }
        .glpCount{
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(2,8,23,0.06);
          border: 1px solid rgba(17,24,39,0.10);
          font-weight: 950;
          font-size: 11px;
          color: rgba(11,18,32,0.75);
        }

        .glpEmpty{
          padding: 10px 12px;
          opacity: .75;
          font-weight: 800;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}