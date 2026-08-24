-- Achicar el mundo del hero un 25% (5200×3800 → 3900×2850).
-- Las obras se acercan al centro; el tamaño de cada imagen no cambia.

update hero_gates
set
  x = round(x * 0.75),
  y = round(y * 0.75),
  updated_at = now()
where exists (select 1 from hero_gates g where g.x >= 4000);
