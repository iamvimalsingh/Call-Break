# 08. UI & Responsive Viewport System

## The 4-Zone Responsive Viewport Architecture (`#table-felt`)

The playing surface is built around a deterministic 4-zone layout inside `src/components/table/GameTable.tsx`:

```
┌────────────────────────────────────────────────────────┐
│ Top Bar HUD: Round, Deal, Scorecard, Audio, Settings   │
├────────────────────────────────────────────────────────┤
│                      #table-felt                       │
│                                                        │
│  [1. Zone: North Player] (Top Center Slot)            │
│                                                        │
│  [2. Zone: Middle Play] (Flex Row, Min-H-0)            │
│    [West Player]   [Center Trick Arena]   [East Player]│
│                                                        │
│  [3. Zone: South/Bidding] (Bidding Panel / South Badge)│
│                                                        │
│  [4. Zone: Human Hand] (13 Cards, Dynamic Overlap)     │
├────────────────────────────────────────────────────────┤
│ Bottom Bar HUD: Rule Coach, History, PWA, Audio Toggle │
└────────────────────────────────────────────────────────┘
```

---

## Breakpoint Behavior Matrix

| Viewport Category | Widths (px) | Card Width | Center Arena | Layout Characteristics |
|---|---|---|---|---|
| **Ultra-Compact Mobile** | 320–360 | 38px | 112px bid / 144px play | 0 horizontal scroll, high-overlap step, 100% visible ranks |
| **Standard Mobile** | 375–430 | 42–48px | 136px bid / 168px play | Optimized touch targets (44px+), crisp rank/suit clarity |
| **Tablet / Foldables** | 640–1024 | 56px | 176px bid / 224px play | Balanced felt cushions, spacious player slot separation |
| **Standard Laptop / Desktop**| 1280–1440 | 64px | 192–200px bid / 240–256px play | Max-size constrained arena, clean vertical buffer above North |
| **Ultra-Wide Desktop** | 1920+ | 64px | Max 256px capped | Table max-w-5xl prevents overstretching, zero collisions |

---

## Zero-Clipping Hand Mechanics (`HumanHand.tsx`)

1. **Dynamic Overlap Calculation**:
   $$\text{Available Width} = \text{Container Width} - \text{Padding}$$
   $$\text{Step} = \min\left(\text{Card Width} - 8, \frac{\text{Available Width} - \text{Card Width}}{N - 1}\right)$$
   $$\text{Overlap} = \text{Card Width} - \text{Step}$$
2. **Selection & Hover**:
   - Selected/playable cards lift upward by `12px – 16px` without clipping against top containers or overflowing viewport boundaries.
   - Dedicated `pt-1 sm:pt-2 md:pt-2.5` headroom ensures full card lift is 100% visible.
