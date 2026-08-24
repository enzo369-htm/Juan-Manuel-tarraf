-- Achicar el mundo del hero otro 25% (3900×2850 → 2925×2138).
-- Si nunca se corrió 006 (coords del mundo 5200), escala 0.75² de una.
-- Si ya se corrió 006, escala 0.75. Si ya está en el mundo nuevo, no toca nada.

update hero_gates
set
  x = round(x * 0.5625),
  y = round(y * 0.5625),
  updated_at = now()
where exists (select 1 from hero_gates g where g.x >= 4000);

update hero_gates
set
  x = round(x * 0.75),
  y = round(y * 0.75),
  updated_at = now()
where exists (select 1 from hero_gates g where g.x >= 2800 and g.x < 4000);
