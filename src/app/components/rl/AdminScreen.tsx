import { useState } from "react";
import { Star, Trash2, Edit, Download, Plus, ArrowLeft } from "lucide-react";
import { useHotels } from "./useHotels";
import { seedPlacesFromFoursquare } from "../../lib/seedPlaces";
import type { Hotel, TravelStyle, Screen } from "./types";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const TEAL = "#0D9488";

const CITIES = [
  "Colombo", "Kandy", "Ella", "Mirissa", "Galle", "Sigiriya",
  "Nuwara Eliya", "Trincomalee", "Negombo", "Dambulla",
  "Anuradhapura", "Jaffna", "Hikkaduwa", "Arugam Bay", "Kalpitiya",
];

const ALL_AMENITIES = [
  "WiFi", "Pool", "Breakfast", "Gym", "Spa", "AC",
  "Restaurant", "Parking", "Beach Access", "Garden",
];

const EMPTY_FORM: Hotel = {
  name: "",
  city: CITIES[0],
  stars: 3,
  priceUSD: 0,
  type: "comfort",
  amenities: [],
  area: "",
  tip: "",
  bookingUrl: "",
  agodaUrl: "",
};

export function AdminScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const { hotels, userHotels, addHotel, removeHotel, updateHotel, exportJSON } = useHotels();
  const [form, setForm] = useState<Hotel>({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<{ name: string; city: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // ── Foursquare → Supabase seeding ──
  const [seedLog, setSeedLog] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);

  // Flatten all hotels to a table
  const allHotels = Object.entries(hotels).flatMap(([city, list]) =>
    list.map((h) => ({ ...h, city }))
  );

  const handleStarClick = (n: number) => setForm((f) => ({ ...f, stars: n }));

  const toggleAmenity = (a: string) => {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter((x) => x !== a)
        : [...f.amenities, a],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.city || form.priceUSD <= 0) return;
    if (editing) {
      updateHotel(editing.name, editing.city, form);
      setEditing(null);
    } else {
      addHotel(form);
    }
    setForm({ ...EMPTY_FORM });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleEdit = (hotel: Hotel & { city: string }) => {
    setForm({ ...hotel });
    setEditing({ name: hotel.name, city: hotel.city });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (name: string, city: string) => {
    if (deleteConfirm === `${name}::${city}`) {
      removeHotel(name, city);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(`${name}::${city}`);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1px solid rgba(11,19,64,0.12)", outline: "none",
    background: "#fff", color: NAVY, fontSize: "0.88rem",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    color: NAVY, fontWeight: 700, fontSize: "0.78rem", marginBottom: 6, display: "block",
  };

  return (
    <div style={{ background: "#EEF2FA", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #1D2E6B 100%)`, padding: "52px 24px 32px" }}>
        <button
          onClick={() => navigate("home")}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}
        >
          <ArrowLeft size={16} color="#fff" />
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem" }}>Back</span>
        </button>
        <p style={{ color: GOLD, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>🔒 ADMIN PANEL</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>Hotel Manager</h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.85rem", marginTop: 8 }}>
          Add, edit, or remove hotels. Exported JSON can be pasted into data.ts.
        </p>
      </div>

      <div style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
        {/* ── Seed Real Places from Foursquare ── */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: 24,
          marginBottom: 24,
          boxShadow: "0 2px 16px rgba(11,19,64,0.07)",
          border: "1px solid rgba(11,19,64,0.06)",
        }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: "1.5rem" }}>🌍</span>
            <h3 style={{
              color: NAVY, fontWeight: 800,
              fontSize: "1rem", margin: 0,
            }}>
              Seed Real Places from Foursquare
            </h3>
          </div>

          <p style={{
            color: "#6B7280", fontSize: "0.82rem",
            lineHeight: 1.6, marginBottom: 16,
          }}>
            Pulls real hotels, restaurants, attractions, beaches and temples for all 12 Sri Lanka
            cities from Foursquare and saves them to Supabase. Run once — takes 2–3 minutes.
            Safe to re-run (duplicates are ignored).
          </p>

          {!seeding && !seedDone && (
            <button
              onClick={async () => {
                setSeeding(true);
                setSeedLog([]);
                setSeedDone(false);
                await seedPlacesFromFoursquare((msg) => {
                  setSeedLog(prev => [...prev.slice(-50), msg]);
                });
                setSeeding(false);
                setSeedDone(true);
              }}
              style={{
                background: GOLD, color: NAVY,
                border: "none", borderRadius: 12,
                padding: "12px 28px",
                fontWeight: 800, fontSize: "0.9rem",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(201,162,39,0.3)",
              }}
            >
              🚀 Start Seeding Places
            </button>
          )}

          {seeding && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 12,
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%",
                border: `2px solid ${GOLD}`,
                borderTopColor: "transparent",
                animation: "spin 0.8s linear infinite",
              }} />
              <span style={{ color: NAVY, fontWeight: 600, fontSize: "0.85rem" }}>
                Seeding in progress...
              </span>
            </div>
          )}

          {seedDone && (
            <div style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 10, padding: "10px 14px",
              marginBottom: 12,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>✅</span>
              <span style={{ color: "#10B981", fontWeight: 700, fontSize: "0.85rem" }}>
                Seeding complete! Check Supabase Table Editor → places
              </span>
            </div>
          )}

          {seedLog.length > 0 && (
            <div style={{
              background: NAVY, borderRadius: 12,
              padding: 16, maxHeight: 220, overflowY: "auto",
              marginTop: 12,
            }}>
              {seedLog.map((line, i) => (
                <p key={i} style={{
                  color: line.startsWith("✅") ? "#10B981"
                       : line.startsWith("⚠️") ? "#F59E0B"
                       : line.startsWith("🎉") ? GOLD
                       : "rgba(255,255,255,0.7)",
                  fontSize: "0.72rem",
                  fontFamily: "monospace",
                  margin: "2px 0", lineHeight: 1.5,
                }}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* ── Hotel Form ── */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "24px", boxShadow: "0 4px 20px rgba(11,19,64,0.07)", marginBottom: 32 }}>
          <h2 style={{ color: NAVY, fontWeight: 800, fontSize: "1.1rem", marginBottom: 20 }}>
            {editing ? "✏️ Edit Hotel" : "➕ Add New Hotel"}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Name */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Hotel Name *</label>
              <input style={inputStyle} placeholder="e.g. Cinnamon Grand Colombo" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            {/* City */}
            <div>
              <label style={labelStyle}>City *</label>
              <select style={inputStyle} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Area */}
            <div>
              <label style={labelStyle}>Area / Neighbourhood</label>
              <input style={inputStyle} placeholder="e.g. Colombo 3, Fort Area" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} />
            </div>

            {/* Price */}
            <div>
              <label style={labelStyle}>Price per Night (USD) *</label>
              <input type="number" style={inputStyle} min={1} placeholder="e.g. 45" value={form.priceUSD || ""} onChange={(e) => setForm((f) => ({ ...f, priceUSD: Number(e.target.value) }))} />
            </div>

            {/* Travel Style */}
            <div>
              <label style={labelStyle}>Travel Style Tier</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["budget", "comfort", "luxury"] as TravelStyle[]).map((s) => (
                  <button key={s} onClick={() => setForm((f) => ({ ...f, type: s }))} style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                    fontWeight: 700, fontSize: "0.78rem",
                    background: form.type === s ? NAVY : "rgba(11,19,64,0.05)",
                    color: form.type === s ? "#fff" : NAVY,
                    transition: "all 0.15s",
                  }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Stars */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Star Rating</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => handleStarClick(n)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <Star size={24} fill={n <= form.stars ? GOLD : "none"} color={n <= form.stars ? GOLD : "#E5E7EB"} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </div>

            {/* Amenities */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Amenities</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ALL_AMENITIES.map((a) => {
                  const active = form.amenities.includes(a);
                  return (
                    <button key={a} onClick={() => toggleAmenity(a)} style={{
                      padding: "7px 14px", borderRadius: 100, border: "none", cursor: "pointer",
                      fontWeight: 600, fontSize: "0.78rem",
                      background: active ? TEAL : "rgba(11,19,64,0.06)",
                      color: active ? "#fff" : "#4B5563",
                      transition: "all 0.15s",
                    }}>
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Local tip */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Local Tip (optional)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                placeholder="e.g. Ask for garden-view room..."
                value={form.tip || ""}
                onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))}
              />
            </div>

            {/* Booking.com URL */}
            <div>
              <label style={labelStyle}>Booking.com Affiliate URL</label>
              <input style={inputStyle} placeholder="https://www.booking.com/hotel/lk/..." value={form.bookingUrl || ""} onChange={(e) => setForm((f) => ({ ...f, bookingUrl: e.target.value }))} />
            </div>

            {/* Agoda URL */}
            <div>
              <label style={labelStyle}>Agoda URL (optional)</label>
              <input style={inputStyle} placeholder="https://www.agoda.com/..." value={form.agodaUrl || ""} onChange={(e) => setForm((f) => ({ ...f, agodaUrl: e.target.value }))} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={handleSave} style={{
              flex: 1, padding: "14px", borderRadius: 12, border: "none", cursor: "pointer",
              background: saved ? TEAL : `linear-gradient(135deg, ${GOLD}, #E8C547)`,
              color: NAVY, fontWeight: 700, fontSize: "0.9rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
            }}>
              <Plus size={16} />
              {saved ? "✓ Saved!" : editing ? "Update Hotel" : "Add Hotel"}
            </button>
            {editing && (
              <button onClick={() => { setEditing(null); setForm({ ...EMPTY_FORM }); }} style={{
                padding: "14px 20px", borderRadius: 12, border: "1px solid rgba(11,19,64,0.1)",
                background: "#fff", cursor: "pointer", color: "#6B7280", fontWeight: 600, fontSize: "0.85rem",
              }}>
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* ── Hotel List ── */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "24px", boxShadow: "0 4px 20px rgba(11,19,64,0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ color: NAVY, fontWeight: 800, fontSize: "1.1rem" }}>
              All Hotels ({allHotels.length})
            </h2>
            <button onClick={exportJSON} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${NAVY}, #1D3560)`,
              color: "#fff", fontWeight: 700, fontSize: "0.8rem",
            }}>
              <Download size={14} />
              Export JSON
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(11,19,64,0.08)" }}>
                  {["Name", "City", "Style", "Price", "Stars", "Source", "Actions"].map((h) => (
                    <th key={h} style={{ color: "#9CA3AF", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em", padding: "10px 12px", textAlign: "left" }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allHotels.map((hotel, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(11,19,64,0.05)", background: i % 2 === 0 ? "transparent" : "rgba(11,19,64,0.01)" }}>
                    <td style={{ padding: "12px", color: NAVY, fontWeight: 600, fontSize: "0.82rem" }}>{hotel.name}</td>
                    <td style={{ padding: "12px", color: "#6B7280", fontSize: "0.8rem" }}>{hotel.city}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        background: hotel.type === "budget" ? `${TEAL}15` : hotel.type === "luxury" ? "rgba(139,92,246,0.15)" : `${GOLD}20`,
                        color: hotel.type === "budget" ? TEAL : hotel.type === "luxury" ? "#8B5CF6" : "#92400E",
                        borderRadius: 100, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 700,
                      }}>
                        {hotel.type}
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: NAVY, fontWeight: 700, fontSize: "0.82rem" }}>${hotel.priceUSD}</td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        {Array.from({ length: hotel.stars }).map((_, si) => (
                          <Star key={si} size={11} fill={GOLD} color={GOLD} />
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        background: hotel.isUserAdded ? "rgba(16,185,129,0.12)" : "rgba(11,19,64,0.06)",
                        color: hotel.isUserAdded ? "#059669" : "#6B7280",
                        borderRadius: 100, padding: "3px 8px", fontSize: "0.68rem", fontWeight: 600,
                      }}>
                        {hotel.isUserAdded ? "User-added" : "Built-in"}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {hotel.isUserAdded && (
                          <>
                            <button onClick={() => handleEdit(hotel as Hotel & { city: string })} style={{
                              padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                              background: `${NAVY}10`, color: NAVY,
                              display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", fontWeight: 600,
                            }}>
                              <Edit size={12} />
                              Edit
                            </button>
                            <button onClick={() => handleDelete(hotel.name, hotel.city ?? "")} style={{
                              padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                              background: deleteConfirm === `${hotel.name}::${hotel.city}` ? "#EF4444" : "rgba(239,68,68,0.1)",
                              color: deleteConfirm === `${hotel.name}::${hotel.city}` ? "#fff" : "#EF4444",
                              display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", fontWeight: 600,
                              transition: "all 0.2s",
                            }}>
                              <Trash2 size={12} />
                              {deleteConfirm === `${hotel.name}::${hotel.city}` ? "Confirm" : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {userHotels.length > 0 && (
            <p style={{ color: "#6B7280", fontSize: "0.75rem", marginTop: 16, textAlign: "center" }}>
              {userHotels.length} user-added hotel{userHotels.length > 1 ? "s" : ""} stored in localStorage. Export JSON to persist in data.ts.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
