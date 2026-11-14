# Football Pitch Tactical Divisions & Coordinate Systems Reference

**Coordinate Convention:** Normalized FIFA standard pitch (`105m` length × `68m` width; internal Konva canvas `1050px × 680px` where `1m = 10px`).
* **`X`-axis (Length / Goal-to-Goal):** `0m` (own goal line) to `105m` (opponent goal line).
* **`Y`-axis (Width / Touchline-to-Touchline):** `0m` (left touchline) to `68m` (right touchline).

---

## 1. Fundamental Pitch Divisions

### A. Horizontal Divisions (Thirds)
Splits the pitch lengthwise from own goal line to opponent goal line (`X`-axis):
* **Defensive Third (`X`: 0m – 35m):** Build-up play, ball progression out of pressure, and goal protection.
* **Middle Third (`X`: 35m – 70m):** Transition control, possession circulation, and pressing traps. *(Often split into **Low Midfield** `35–52.5m` and **High Midfield** `52.5–70m` for a 4-tier model).*
* **Attacking / Final Third (`X`: 70m – 105m):** Chance creation, penetrating the defensive block, and finishing.

### B. Vertical Divisions (Five Channels / Lanes)
Splits the pitch widthwise (`Y`-axis) anchored to standard FIFA pitch markings (18-yard penalty area = `40.32m` wide; 6-yard goal area = `18.32m` wide):
1. **Left Flank / Wide Area (`Y`: 0m – 13.84m):** Left touchline to left edge of 18-yard box. Purpose: stretching opposition horizontally, overlaps, crosses.
2. **Left Half-Space (`Y`: 13.84m – 24.84m):** Left edge of 18-yard box to left edge of 6-yard box. Purpose: creative pockets with diagonal passing angles toward goal.
3. **Central Corridor (`Y`: 24.84m – 43.16m):** Aligned with the 6-yard goal area width (`18.32m`). Purpose: direct vertical progression, central combinations, high-percentage shots.
4. **Right Half-Space (`Y`: 43.16m – 54.16m):** Right edge of 6-yard box to right edge of 18-yard box. Purpose: mirror of left half-space; inverted wingers and attacking #8s.
5. **Right Flank / Wide Area (`Y`: 54.16m – 68.0m):** Right edge of 18-yard box to right touchline. Purpose: width maintenance, 1v1 isolation, cutbacks.

### C. Specialized Tactical Sub-Zones
* **Zone 14:** Directly in front of the opponent's penalty box in the Central Corridor (`X`: ~70m–88.5m, `Y`: ~22.67m–45.33m). Known as the "assist zone" for yielding the highest shot-on-target conversion from passes.
* **The Pockets (Between the Lines):** Dynamic horizontal space between opposition defensive and midfield lines, most dangerous inside the Left and Right Half-Spaces (`X`: 52.5m–88.5m, `Y`: 13.84–24.84m & 43.16–54.16m).
* **The Golden Zone:** Central rectangle inside the penalty box spanning the width of the 6-yard box out to the penalty spot (`X`: 94m–105m, `Y`: 24.84m–43.16m).
* **Byline Cutback Zone:** Space inside the penalty box between the 6-yard box and the goal line/touchline intersection (`X`: 88.5m–105m, `Y`: 13.84–24.84m & 43.16–54.16m) for low pulled-back crosses.

---

## 2. The Standard 18-Zone Grid (3 Columns × 6 Rows)
Divides the pitch into **3 equal vertical lanes** (`22.67m` wide each) and **6 equal horizontal strips** (`17.5m` deep each), numbered sequentially `1` to `18` from left-to-right, starting at the own goal line (`X = 0`).

* **Left Lane (`Y`: 0.00m – 22.67m)**
* **Central Lane (`Y`: 22.67m – 45.33m)**
* **Right Lane (`Y`: 45.33m – 68.00m)**

| Horizontal Strip (`X` Depth) | Left Lane (`0–22.67m`) | Central Lane (`22.67–45.33m`) | Right Lane (`45.33–68m`) |
| :--- | :--- | :--- | :--- |
| **Row 6: Deep Attacking (`87.5 – 105.0m`)** | **Zone 16** (Left Box/Byline) | **Zone 17** (Penalty Box / Golden Zone) | **Zone 18** (Right Box/Byline) |
| **Row 5: High Attacking (`70.0 – 87.5m`)** | **Zone 13** (Left Wing) | **Zone 14** *(Assist Zone)* | **Zone 15** (Right Wing) |
| **Row 4: High Midfield (`52.5 – 70.0m`)** | **Zone 10** | **Zone 11** (Center Circle Opp. Half) | **Zone 12** |
| **Row 3: Low Midfield (`35.0 – 52.5m`)** | **Zone 7** | **Zone 8** (Center Circle Own Half) | **Zone 9** |
| **Row 2: High Defensive (`17.5 – 35.0m`)** | **Zone 4** | **Zone 5** (Own Zone 14) | **Zone 6** |
| **Row 1: Deep Defensive (`0.0 – 17.5m`)** | **Zone 1** | **Zone 2** (Own Penalty Box) | **Zone 3** |

---

## 3. The 20-Zone *Juego de Posición* Grid (5 Columns × 4 Rows)
Combines the **5 vertical channels** (tied to pitch markings) with **4 horizontal functional tiers** (`26.25m` deep each). Uses alphanumeric codes rather than 1–20 numbers to enforce positional play spacing rules (e.g., max 3 players horizontally, max 2 players vertically).

| Horizontal Tier (`X` Depth) | Left Flank (`0–13.84m`) | Left Half-Space (`13.84–24.84m`) | Central Corridor (`24.84–43.16m`) | Right Half-Space (`43.16–54.16m`) | Right Flank (`54.16–68m`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 4: Finishing (`78.75 – 105.0m`)** | `F-LF` | `F-LHS` | `F-C` | `F-RHS` | `F-RF` |
| **Tier 3: Creation (`52.5 – 78.75m`)** | `C-LF` | `C-LHS` *(Prime Pocket)* | `C-C` | `C-RHS` *(Prime Pocket)* | `C-RF` |
| **Tier 2: Progression (`26.25 – 52.5m`)** | `P-LF` | `P-LHS` | `P-C` | `P-RHS` | `P-RF` |
| **Tier 1: Build-Up (`0.0 – 26.25m`)** | `B-LF` | `B-LHS` | `B-C` | `B-RHS` | `B-RF` |

---

## 4. Coordinate Mapping Functions (TypeScript)

Implemented in `src/app/pitch-board/canvas/pitch-divisions.ts`:

```ts
// Input: x in [0, 105], y in [0, 68]

export function getZone18(x: number, y: number): number {
  const col = Math.min(2, Math.max(0, Math.floor(y / (68 / 3))));   // 0: Left, 1: Center, 2: Right
  const row = Math.min(5, Math.max(0, Math.floor(x / (105 / 6))));  // 0..5 from own goal to opp goal
  return row * 3 + col + 1;
}

export function getZone20(x: number, y: number): string {
  const getChannel = (yPos: number): string => {
    if (yPos < 13.84) return 'LF';
    if (yPos < 24.84) return 'LHS';
    if (yPos < 43.16) return 'C';
    if (yPos < 54.16) return 'RHS';
    return 'RF';
  };

  const tiers = ['B', 'P', 'C', 'F']; // Build-Up, Progression, Creation, Finishing
  const tierIndex = Math.min(3, Math.max(0, Math.floor(x / 26.25)));
  return `${tiers[tierIndex]}-${getChannel(y)}`;
}
```
